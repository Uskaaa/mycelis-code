/**
 * Authentication handlers — extracted from KiloProvider.
 *
 * Manages login (device auth flow), logout, organization switching,
 * and profile refresh. No vscode dependency.
 */

import type { KiloClient } from "@kilocode/sdk/v2/client"
import { getErrorMessage } from "../../kilo-provider-utils"

export interface AuthContext {
  readonly client: KiloClient | null
  postMessage(msg: unknown): void
  getWorkspaceDirectory(): string
  disposeGlobal(): Promise<void>
  invalidateProviderUsage(): void
  invalidateProviders(): void
  fetchAndSendProviders(): Promise<void>
  fetchAndSendAgents(): Promise<void>
  fetchAndSendSpeechToTextModels(): Promise<void>
}

/**
 * Handle login via the provider OAuth device-auth flow.
 * Sends device auth messages so the webview can display QR code, code, and timer.
 *
 * @param attempt - The current login attempt counter value (pre-incremented by caller).
 * @param getAttempt - Returns the latest attempt counter (may have changed if user cancelled).
 */
export async function handleLogin(ctx: AuthContext, attempt: number, getAttempt: () => number): Promise<void> {
  if (!ctx.client) return

  console.log("[Kilo New] KiloProvider: 🔐 Starting login flow...")

  try {
    const dir = ctx.getWorkspaceDirectory()

    // Step 1: Initiate OAuth authorization
    const { data: auth } = await ctx.client.provider.oauth.authorize(
      { providerID: "kilo", method: 0, directory: dir },
      { throwOnError: true },
    )
    console.log("[Kilo New] KiloProvider: 🔐 Got auth URL:", auth.url)

    // Mycelis's browser-login method opens the browser itself (see callback() below) and never
    // hands back a manual entry code — the webview shows a plain waiting state for it instead of
    // the QR/code UI built for the old device-authorization flow.
    const auto = auth.method === "auto"

    // Parse code from instructions (format: "Open URL and enter code: ABCD-1234")
    const match = auto ? undefined : auth.instructions?.match(/code:\s*(\S+)/i)
    const code = match ? match[1] : undefined

    // Send device auth details to webview
    ctx.postMessage({
      type: "deviceAuthStarted",
      code,
      verificationUrl: auth.url,
      expiresIn: auto ? 300 : 900, // auto (browser-login) callback times out after 5 minutes; device-code flow defaults to 15
      auto,
    })

    // Step 2: Wait for callback (blocks until polling completes)
    await ctx.client.provider.oauth.callback({ providerID: "kilo", method: 0, directory: dir }, { throwOnError: true })

    // Check if this attempt was cancelled
    if (attempt !== getAttempt()) return

    console.log("[Kilo New] KiloProvider: 🔐 Login successful")

    ctx.invalidateProviderUsage()
    ctx.invalidateProviders()

    // Step 3: Fetch profile and push to webview
    const { data: profile } = await ctx.client.kilo.profile(undefined, { throwOnError: true })
    ctx.postMessage({ type: "profileData", data: profile })
    // mycelis_change - was gated behind disposeGlobal() (client.global.dispose()) - a full
    // teardown/rebuild of every provider/model list for every open instance, not just this one's,
    // which is what made login "take forever" even though the actual OAuth callback had already
    // succeeded. Fire deviceAuthComplete as soon as we have a profile - the model list itself is
    // still refreshing in the background below, and the model picker already shows a loading
    // state for that (see ModelSelector.tsx) instead of blocking here.
    ctx.postMessage({ type: "deviceAuthComplete" })
    ctx.fetchAndSendProviders().catch((e) =>
      console.error("[Kilo New] KiloProvider: Failed to refresh providers after login:", e),
    )
    ctx.fetchAndSendAgents().catch((e) =>
      console.error("[Kilo New] KiloProvider: Failed to refresh agents after login:", e),
    )
  } catch (error) {
    if (attempt !== getAttempt()) return
    ctx.postMessage({
      type: "deviceAuthFailed",
      error: getErrorMessage(error) || "Login failed",
    })
  }
}

/** Handle logout: remove auth credentials and clear profile. */
export async function handleLogout(ctx: AuthContext): Promise<void> {
  if (!ctx.client) return

  try {
    console.log("[Kilo New] KiloProvider: 🚪 Logging out...")
    await ctx.client.auth.remove({ providerID: "kilo" }, { throwOnError: true })
    console.log("[Kilo New] KiloProvider: 🚪 Logged out successfully")
    ctx.postMessage({ type: "profileData", data: null })

    ctx.invalidateProviderUsage()
    ctx.invalidateProviders()
    await ctx.disposeGlobal()

    await ctx.fetchAndSendProviders()
  } catch (error) {
    console.error("[Kilo New] KiloProvider: ❌ Logout failed:", error)
    ctx.postMessage({
      type: "error",
      message: getErrorMessage(error) || "Failed to logout",
    })
  }
}

/**
 * Handle organization switch.
 * Persists the selection and refreshes profile + providers since both change with org context.
 */
export async function handleSetOrganization(ctx: AuthContext, organizationId: string | null): Promise<void> {
  if (!ctx.client) return

  console.log("[Kilo New] KiloProvider: Switching organization:", organizationId ?? "personal")
  try {
    // mycelis_change - the CLI's provider/model cache for a directory is keyed by that exact
    // directory (InstanceState in opencode). Without `directory` here, the server's own
    // provider.invalidate() (run as part of this same request - see kilo-gateway.ts) invalidated
    // its directory-less default instance instead of this workspace's, leaving the real workspace
    // cache stale. That staleness used to get papered over by disposeGlobal() below doing a full
    // global.dispose() - tearing down and rebuilding every provider/model list for every open
    // instance, not just this workspace's - which is the "takes forever" switch users saw.
    await ctx.client.kilo.organization.set(
      { organizationId, directory: ctx.getWorkspaceDirectory() },
      { throwOnError: true },
    )
  } catch (error) {
    console.error("[Kilo New] KiloProvider: Failed to switch organization:", error)
    // Re-fetch current profile to reset webview state — best-effort
    try {
      const result = await ctx.client.kilo.profile()
      ctx.postMessage({ type: "profileData", data: result.data ?? null })
    } catch (profileError) {
      console.error("[Kilo New] KiloProvider: Failed to refresh profile after org switch error:", profileError)
    }
    return
  }

  ctx.invalidateProviderUsage()
  ctx.invalidateProviders()

  // Org switch succeeded — refresh profile and providers independently (best-effort)
  try {
    const result = await ctx.client.kilo.profile()
    ctx.postMessage({ type: "profileData", data: result.data ?? null })
  } catch (error) {
    console.error("[Kilo New] KiloProvider: Failed to refresh profile after org switch:", error)
  }
  try {
    await ctx.fetchAndSendProviders()
  } catch (error) {
    console.error("[Kilo New] KiloProvider: Failed to refresh providers after org switch:", error)
  }
  try {
    await ctx.fetchAndSendAgents()
  } catch (error) {
    console.error("[Kilo New] KiloProvider: Failed to refresh agents after org switch:", error)
  }
  try {
    await ctx.fetchAndSendSpeechToTextModels()
  } catch (error) {
    console.error("[Kilo New] KiloProvider: Failed to refresh speech-to-text models after org switch:", error)
  }
}

/** Handle profile refresh request. */
export async function handleRefreshProfile(ctx: AuthContext): Promise<void> {
  if (!ctx.client) return

  console.log("[Kilo New] KiloProvider: 🔄 Refreshing profile...")
  const result = await ctx.client.kilo.profile().catch(() => ({ data: null }))
  ctx.postMessage({ type: "profileData", data: result.data ?? null })
}
