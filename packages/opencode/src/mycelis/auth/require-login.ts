// mycelis_change - new file
//
// Gate the interactive TUI behind a Mycelis account, mirroring how Claude Code
// and GitHub Copilot require sign-in before first use. Kilo itself allows
// anonymous usage (DEFAULT_FREE_MODEL / ANONYMOUS_API_KEY in
// @kilocode/kilo-gateway); Mycelis intentionally does not.
//
// This reuses the device-authorization flow already implemented for the
// "kilo" provider (packages/kilo-gateway/src/auth/device-auth-tui.ts), which
// talks to KILO_API_BASE/KILO_CHAT_URL from packages/kilo-gateway/src/api/constants.ts.
// Once the Mycelis backend's OAuth endpoints are live, point those constants
// (or the KILO_API_URL / KILO_CHAT_URL / EVENT_SERVICE_URL env vars) at them —
// nothing here needs to change.
import { UI } from "@/cli/ui"

/** Set to skip the gate, e.g. for CI, scripted/non-interactive commands, or local testing. */
export const ENV_SKIP_AUTH_GATE = "MYCELIS_SKIP_AUTH_GATE"

export async function ensureMycelisAuth(): Promise<void> {
  if (process.env[ENV_SKIP_AUTH_GATE] === "1") return
  // Only gate genuinely interactive sessions; scripted/non-TTY invocations
  // (CI, piped input) would otherwise hang waiting for a browser login.
  if (!process.stdout.isTTY) return

  const { AppRuntime } = await import("@/effect/app-runtime")
  const { Auth } = await import("@/auth")

  const existing = await AppRuntime.runPromise(Auth.Service.use((s) => s.get("kilo")))
  if (existing) return

  const { authenticateWithDeviceAuthTUI } = await import("@kilocode/kilo-gateway")

  UI.empty()
  UI.println(UI.Style.TEXT_NORMAL_BOLD + "Sign in to Mycelis to continue" + UI.Style.TEXT_NORMAL)

  let auth: Awaited<ReturnType<typeof authenticateWithDeviceAuthTUI>>
  try {
    auth = await authenticateWithDeviceAuthTUI()
  } catch (err) {
    UI.error(`Could not start sign-in: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  UI.println(auth.instructions)
  UI.println(UI.Style.TEXT_DIM + "Waiting for authorization..." + UI.Style.TEXT_NORMAL)

  if (auth.method !== "auto") {
    UI.error("Sign-in failed: unsupported authorization method.")
    process.exit(1)
  }
  const result = await auth.callback()
  if (result.type !== "success" || !("access" in result)) {
    UI.error("Sign-in failed or was cancelled. Run `kilo auth login` to try again.")
    process.exit(1)
  }

  await AppRuntime.runPromise(
    Auth.Service.use((s) =>
      s.set("kilo", {
        type: "oauth",
        access: result.access,
        refresh: result.refresh,
        expires: result.expires,
        accountId: result.accountId,
      }),
    ),
  )

  UI.println(UI.Style.TEXT_SUCCESS + "Signed in." + UI.Style.TEXT_NORMAL)
  UI.empty()
}
