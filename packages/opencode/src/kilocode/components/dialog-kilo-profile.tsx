/**
 * Kilo Gateway Profile Dialog
 *
 * Displays user profile information with a clickable usage details link.
 */

import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { Link } from "@tui/ui/link"
import { TextAttributes } from "@opentui/core"
import { MYCELIS_WEB_URL, type KilocodeProfile, type KilocodeBalance } from "@kilocode/kilo-gateway" // mycelis_change

interface DialogKiloProfileProps {
  profile: KilocodeProfile
  balance: KilocodeBalance | null
  currentOrgId?: string | null
}

export function DialogKiloProfile(props: DialogKiloProfileProps) {
  const { theme } = useTheme()
  const dialog = useDialog()

  useKeyboard((evt: any) => {
    if (evt.name === "return") {
      dialog.clear()
    }
  })

  // mycelis_change - default to the owned workspace when no selection has ever been made; there's
  // no separate "personal account" fallback anymore, everything runs through workspaces.
  const currentOrg =
    props.profile.organizations?.find((org) => org.id === props.currentOrgId) ??
    props.profile.organizations?.find((org) => org.role === "Owner") ??
    props.profile.organizations?.[0]

  const workspaceDisplay = currentOrg ? `${currentOrg.name} (${currentOrg.role})` : "—"

  const balanceDisplay =
    props.balance && props.balance.balance !== undefined && props.balance.balance !== null
      ? `$${props.balance.balance.toFixed(2)}`
      : null

  // mycelis_change - Mycelis's dashboard has no per-workspace deep link for usage/spend (it
  // operates on whichever workspace is active in the browser session, not a URL param) - point
  // at the settings page (spend/billing) instead of the old hardcoded app.kilo.ai link.
  const usageUrl = `${MYCELIS_WEB_URL}/dashboard/settings`

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Mycelis Profile{/* mycelis_change */}
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>
      <box paddingBottom={1}>
        {props.profile.name && <text fg={theme.text}>Name: {props.profile.name}</text>}
        {props.profile.email && <text fg={theme.text}>Email: {props.profile.email}</text>}
        <text fg={theme.text}>Workspace: {workspaceDisplay}</text>
        {balanceDisplay && <text fg={theme.text}>Balance: {balanceDisplay}</text>}
        <box marginTop={1}>
          <box flexDirection="row">
            <text fg={theme.text}>Usage Details: </text>
            <Link href={usageUrl} fg={theme.primary}>
              {usageUrl}
            </Link>
          </box>
        </box>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={() => dialog.clear()}>
          <text fg={theme.selectedListItemText}>ok</text>
        </box>
      </box>
    </box>
  )
}
