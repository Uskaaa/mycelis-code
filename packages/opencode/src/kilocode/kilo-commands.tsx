/**
 * Kilo Gateway Commands for TUI
 *
 * Provides /profile and /teams commands that are only visible when connected to Kilo Gateway.
 */

import { createMemo } from "solid-js"
import { useBindings } from "@tui/keymap"
import { useSync } from "@tui/context/sync"
import { useConnected } from "@tui/component/use-connected" // mycelis_change
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { reconcile } from "solid-js/store"
import type { Organization } from "@kilocode/kilo-gateway"
import { DialogKiloWorkspaceSelect } from "./components/dialog-kilo-workspace-select.js" // mycelis_change
import { DialogKiloProfile } from "./components/dialog-kilo-profile.js"
import { DialogIndexing } from "./components/dialog-indexing.js"
import { DialogProviderUsage } from "./components/dialog-provider-usage.js"
import { DialogDeployments } from "./components/dialog-deployments.js" // mycelis_change
import { indexingEnabled } from "./indexing-feature"
import { refreshBalance } from "./balance-refresh"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any
type SDK = any

/**
 * Register all Kilo Gateway commands
 * Call this from a component inside the TUI app
 *
 * @param useSDK - OpenCode's useSDK hook (passed from TUI context)
 */
export function registerKiloCommands(useSDK: () => UseSDK) {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const toast = useToast()

  // Only show Kilo commands when connected to Kilo Gateway
  // mycelis_change - "kilo" always autoloads anonymously as Kilo's free tier, so a raw
  // provider_next.connected.includes("kilo") is unconditionally true; useConnected() checks the
  // provider's actual source instead (see use-connected.tsx for why).
  const isKiloConnected = useConnected()
  const indexing = createMemo(() => indexingEnabled(sync.data.config))

  useBindings(() => ({
    commands: [
      // /remote command
      {
        name: "remote.toggle",
        title: "Toggle remote",
        desc: "Enable or disable remote session relay",
        category: "Mycelis", // mycelis_change
        slashName: "remote",
        enabled: isKiloConnected(),
        hidden: !isKiloConnected(),
        run: async () => {
          try {
            const current = await sdk.client.remote.status()

            if (current.error || !current.data) {
              dialog.replace(() => <DialogAlert title="Error" message="Failed to fetch remote status." />)
              return
            }

            if (current.data.enabled) {
              await sdk.client.remote.disable()
              toast.show({ message: "Remote disabled", variant: "success" })
            } else {
              const result = await sdk.client.remote.enable()
              if (result.error) {
                const err = result.error as { error?: string }
                const msg = err?.error ?? "Failed to enable remote."
                dialog.replace(() => <DialogAlert title="Error" message={msg} />)
                return
              }
              toast.show({ message: "Remote enabled", variant: "success" })
            }

            dialog.clear()
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to toggle remote: ${error}`} />)
          }
        },
      },

      {
        name: "kilo.usage",
        title: "Plans & usage",
        desc: "View provider plans and quota",
        category: "Mycelis", // mycelis_change
        slashName: "usage",
        slashAliases: ["plans", "quota"],
        run: () => {
          dialog.replace(() => <DialogProviderUsage />)
        },
      },

      // /deployments command
      // mycelis_change - opens the compact overview first (start/stop/delete existing
      // deployments); creating a new one is one of the actions from there, not a separate
      // top-level command, so there's always a single, predictable entry point.
      {
        name: "kilo.deployments",
        title: "Deployments",
        desc: "View and manage Mycelis deployments",
        category: "Mycelis",
        slashName: "deployments",
        slashAliases: ["deploy", "instances"],
        enabled: isKiloConnected(),
        hidden: !isKiloConnected(),
        run: async () => {
          // mycelis_change - fetch before opening (same pattern as /profile and /workspace
          // below), not inside the dialog's own onMount - see dialog-deployments.tsx for why.
          try {
            const response = await sdk.client.kilo.deployments.list()
            if (response.error || !response.data) {
              const err = response.error as { error?: string } | undefined
              dialog.replace(() => (
                <DialogAlert title="Error" message={err?.error ?? "Failed to fetch deployments."} />
              ))
              return
            }
            dialog.replace(() => <DialogDeployments useSDK={useSDK} initialDeployments={response.data} />)
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to fetch deployments: ${error}`} />)
          }
        },
      },

      // /profile command
      {
        name: "kilo.profile",
        title: "Profile",
        desc: "View your Mycelis profile", // mycelis_change
        category: "Mycelis", // mycelis_change
        slashName: "profile",
        slashAliases: ["me", "whoami"],
        enabled: isKiloConnected(),
        hidden: !isKiloConnected(),
        run: async () => {
          try {
            if (sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true) {
              const confirmed = await DialogConfirm.show(
                dialog,
                "Privacy Mode Enabled",
                "Privacy mode is on. Revealing your profile will display your email, name, balance, and team on screen.",
              )
              if (confirmed !== true) return
            }

            // Fetch profile and balance using server endpoint
            const response = await sdk.client.kilo.profile()

            if (response.error || !response.data) {
              dialog.replace(() => (
                <DialogAlert
                  title="Error"
                  message="Failed to fetch profile. Please ensure you're authenticated with Mycelis." // mycelis_change
                />
              ))
              return
            }

            const { profile, balance, currentOrgId } = response.data

            // Show profile dialog with clickable usage link
            dialog.replace(() => <DialogKiloProfile profile={profile} balance={balance} currentOrgId={currentOrgId} />)
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to fetch profile: ${error}`} />)
          }
        },
      },

      ...(indexing()
        ? [
            {
              name: "kilo.indexing",
              title: "Indexing",
              desc: "Configure codebase indexing",
              category: "Mycelis", // mycelis_change
              slashName: "indexing",
              slashAliases: ["index", "embedding"],
              run: () => {
                dialog.replace(() => <DialogIndexing useSDK={useSDK} />)
              },
            },
          ]
        : []),

      // /privacy command
      {
        name: "kilo.privacy",
        get title() {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          return active ? "Disable privacy mode" : "Enable privacy mode"
        },
        desc: "Blur PII (balance, email, etc.) and confirm before showing profile",
        category: "Mycelis", // mycelis_change
        slashName: "privacy",
        run: async () => {
          const active = sync.data.config.privacy_mode === true || sync.data.globalConfig.privacy_mode === true
          const next = !active
          const updates = [
            sdk.client.config.overlayUpdate({
              scope: "global",
              set: { privacy_mode: next },
              skipResponse: true, // mycelis_change - the response is never used; see ConfigOverlayPatch.skipResponse
            }),
          ]
          if (!next && sync.data.config.privacy_mode === true) {
            updates.push(
              sdk.client.config.overlayUpdate({
                scope: "project",
                unset: [["privacy_mode"]],
                skipResponse: true, // mycelis_change
              }),
            )
          }
          const responses = await Promise.all(updates)
          const failed = responses.find((r) => r.error)
          if (failed) {
            const status = failed.response?.status ?? "?"
            toast.show({ message: `Failed to update privacy mode (${status})`, variant: "error" })
            return
          }
          // mycelis_change - show feedback as soon as the toggle itself succeeded instead of
          // gating it behind a second round trip (two more config.get() calls) that only exists
          // to refresh local state. /auto-approve feels instant because it does exactly one call
          // before toasting; this now matches that instead of waiting on ~3 sequential requests.
          toast.show({
            message: next ? "Privacy mode enabled" : "Privacy mode disabled",
            variant: "success",
          })
          const [cfg, global] = await Promise.all([
            sdk.client.config.get({}),
            sdk.client.global.config.get({}),
          ])
          if (cfg.data) sync.set("config", reconcile(cfg.data))
          if (global.data) sync.set("globalConfig", reconcile(global.data))
        },
      },

      // /workspace command
      // mycelis_change - renamed from /teams: everything runs through workspaces now, so there's
      // no separate "personal account" concept to pick between - just a list of workspaces
      // (owned or joined) to switch to. See ProfileController in Mycelis.WebApp.
      {
        name: "kilo.workspaces",
        title: "Workspaces",
        desc: "Switch between Mycelis workspaces",
        category: "Mycelis",
        slashName: "workspace",
        slashAliases: ["workspaces"],
        enabled: isKiloConnected(),
        hidden: !isKiloConnected(),
        run: async () => {
          try {
            // Fetch profile to get workspaces
            const response = await sdk.client.kilo.profile()

            if (response.error || !response.data) {
              dialog.replace(() => (
                <DialogAlert
                  title="Error"
                  message="Failed to fetch workspaces. Please ensure you're authenticated with Mycelis."
                />
              ))
              return
            }

            const { profile, currentOrgId } = response.data
            const organizations = profile.organizations ?? []

            if (organizations.length === 0) {
              dialog.replace(() => (
                <DialogAlert title="No Workspaces Available" message="You don't have any workspaces yet." />
              ))
              return
            }

            // Default to the owned workspace until a selection has ever been made
            const effectiveCurrentOrgId =
              currentOrgId ?? organizations.find((o: Organization) => o.role === "Owner")?.id ?? organizations[0].id

            // Show workspace selection dialog
            dialog.replace(() => (
              <DialogKiloWorkspaceSelect
                organizations={organizations}
                currentOrgId={effectiveCurrentOrgId}
                onSelect={async (orgId) => {
                  try {
                    // Switch workspace immediately using server endpoint
                    const result = await sdk.client.kilo.organization.set({
                      organizationId: orgId,
                    })
                    if (result.error) {
                      toast.show({
                        message: "Failed to switch workspace",
                        variant: "error",
                      })
                      dialog.clear()
                      return
                    }

                    // Show success toast and close immediately - don't make the user wait on
                    // the dialog for this.
                    const workspaceName = organizations.find((o: Organization) => o.id === orgId)?.name
                    toast.show({
                      message: `Switched to: ${workspaceName}`,
                      variant: "success",
                    })
                    dialog.clear()

                    // mycelis_change - re-resolving the full provider/model list (not just
                    // Mycelis's, which alone answers in ~25ms) takes several seconds - it's the
                    // same fixed cost as any provider cache invalidation, unrelated to this
                    // switch specifically. Run it in the background instead of blocking the
                    // dialog on it; the model picker and prompt bar already re-validate the
                    // selected model reactively once sync.data.provider updates (see
                    // isModelValid/currentModel in tui/context/local.tsx), so there's nothing
                    // else to wait for here.
                    void sync.bootstrap().then(() => refreshBalance())
                  } catch (error) {
                    if (error instanceof DOMException && error.name === "AbortError") return
                    toast.show({
                      message: "Failed to switch workspace",
                      variant: "error",
                    })
                    dialog.clear()
                  }
                }}
              />
            ))
          } catch (error) {
            dialog.replace(() => <DialogAlert title="Error" message={`Failed to fetch workspaces: ${error}`} />)
          }
        },
      },
    ].map((command) => ({
      namespace: "palette",
      ...command,
    })),
  }))
}
