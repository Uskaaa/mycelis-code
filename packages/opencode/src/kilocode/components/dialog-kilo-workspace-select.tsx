/**
 * Mycelis Workspace Selection Dialog
 *
 * Lets the user switch between the workspaces they own or belong to. There's no separate
 * "personal account" - a user's own workspace is just another entry in the list.
 * Marks the current workspace with "→ (current)".
 */

import { DialogSelect } from "@tui/ui/dialog-select"
import type { Organization } from "@kilocode/kilo-gateway"
import { getOrganizationOptions } from "@kilocode/kilo-gateway/tui"

interface DialogKiloWorkspaceSelectProps {
  organizations: Organization[]
  currentOrgId?: string | null
  onSelect: (orgId: string) => Promise<void>
}

export function DialogKiloWorkspaceSelect(props: DialogKiloWorkspaceSelectProps) {
  const options = getOrganizationOptions(props.organizations, props.currentOrgId || undefined)

  return (
    <DialogSelect
      title="Select Workspace"
      options={options}
      current={props.currentOrgId || null}
      onSelect={async (option: any) => {
        await props.onSelect(option.value)
      }}
    />
  )
}
