/**
 * Browser-login completion handler for Mycelis.
 *
 * mycelis_change - this used to also drive Kilo Cloud's org-selection step (fetching
 * /kilo/profile and letting the user switch organizations) after the device-auth flow
 * completed. Mycelis auth stores a PAT as auth.type "api", not "oauth", so kilo.profile()
 * (which requires type "oauth") always failed here - silently on callback errors, and with
 * a misleading "using personal account" toast on success. Org/tenant resolution already
 * happens server-side when the PAT is minted (OidcProviderController.Token), so there is
 * nothing left for this component to do beyond reporting success or failure.
 */

import { onMount } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog } from "@tui/ui/dialog"
import { useSync } from "@tui/context/sync"
import { useToast } from "@tui/ui/toast"
import { Link } from "@tui/ui/link"
import * as Clipboard from "@tui/clipboard"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any
type UseTheme = any
type ProviderAuthAuthorization = any
type DialogModel = any

interface KiloAutoMethodProps {
  index: number
  providerID: string
  title: string
  authorization: ProviderAuthAuthorization
  useSDK: () => UseSDK
  useTheme: () => UseTheme
  DialogModel: DialogModel
}

export function KiloAutoMethod(props: KiloAutoMethodProps) {
  const { theme } = props.useTheme()
  const sdk = props.useSDK()
  const dialog = useDialog()
  const sync = useSync()
  const toast = useToast()

  useKeyboard((evt: any) => {
    if (evt.name === "c" && !evt.ctrl && !evt.meta) {
      const code = props.authorization.instructions.match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0] ?? props.authorization.url
      Clipboard.write(code)
        .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
        .catch(toast.error)
    }
  })

  onMount(async () => {
    try {
      const result = await sdk.client.provider.oauth.callback({
        providerID: props.providerID,
        method: props.index,
      })

      if (result.error) {
        toast.show({
          variant: "error",
          message:
            "name" in result.error && result.error.name === "ProviderAuthOauthCallbackFailed"
              ? "Sign-in failed. Try /connect again."
              : JSON.stringify(result.error),
        })
        dialog.clear()
        return
      }

      // mycelis_change - the oauth callback above already invalidates just the provider/model
      // cache server-side (see provider-auth-lifecycle.ts); a full instance.dispose() here was
      // redundant and is what made sign-in feel slow (tears down and restarts LSP clients etc.
      // just to pick up a refreshed provider list).
      await sync.bootstrap()
      toast.show({ message: "Signed in to Mycelis", variant: "success" })
      dialog.replace(() => <props.DialogModel providerID={props.providerID} />)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return

      console.warn("Mycelis sign-in failed:", error)
      toast.show({
        variant: "error",
        message: "Sign-in failed. Try /connect again.",
      })
      dialog.clear()
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      <box gap={1}>
        <Link href={props.authorization.url} fg={theme.primary} />
        <text fg={theme.textMuted}>{props.authorization.instructions}</text>
      </box>

      <text fg={theme.textMuted}>Waiting for authorization...</text>

      <text fg={theme.text}>
        c <span style={{ fg: theme.textMuted }}>copy</span>
      </text>
    </box>
  )
}
