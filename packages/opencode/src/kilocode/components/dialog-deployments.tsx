/**
 * Mycelis Deployments Overview
 *
 * mycelis_change - new file. Compact list of the active workspace's deployments (see
 * DeploymentsController/DeploymentsProxyController in orchestration), plus a permanently visible
 * "+ New deployment" row that launches the create flow (dialog-deployment-create.tsx).
 *
 * mycelis_change - selecting an existing deployment used to immediately toggle start/stop, and
 * "create" was only reachable when the list was empty (or via a DialogSelect `actions` entry that
 * never actually surfaced - see dialog-deployment-detail.tsx's sibling PR notes). Both are now
 * regular, always-visible rows: "+ New deployment" pinned first, and selecting a deployment opens
 * a detail view (dialog-deployment-detail.tsx) to start/stop/delete instead of acting instantly.
 */

import { createSignal } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { DialogDeploymentCreate } from "./dialog-deployment-create.js"
import { DialogDeploymentDetail } from "./dialog-deployment-detail.js"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any

interface Deployment {
  id: string
  name: string
  modelName: string
  status: string
  costPerHour: number
}

type Row = { kind: "create" } | { kind: "open"; deployment: Deployment }

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

interface DialogDeploymentsProps {
  useSDK: () => UseSDK
  // mycelis_change - fetched by the /deployments command BEFORE opening this dialog (same
  // pattern as /profile and /workspace) instead of fetching inside onMount here. This dialog's
  // own onMount fetch used to fire far more often than "the user pressed /deployments once" -
  // the terminal renderer re-runs component bodies more eagerly than a DOM renderer would, so
  // any fetch triggered from onMount here turned into a request storm hammering the backend.
  initialDeployments: Deployment[]
}

export function DialogDeployments(props: DialogDeploymentsProps) {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const sdk = props.useSDK()
  const [deployments, setDeployments] = createSignal<Deployment[]>(props.initialDeployments)

  function statusColor(status: string) {
    if (status === "Running") return theme.success
    if (status === "Error") return theme.error
    return theme.textMuted
  }

  function reopen(list: Deployment[]) {
    dialog.replace(() => <DialogDeployments useSDK={props.useSDK} initialDeployments={list} />)
  }

  async function refreshAndReopen() {
    try {
      const response = await sdk.client.kilo.deployments.list()
      reopen((response?.data as Deployment[]) ?? deployments())
    } catch {
      reopen(deployments())
    }
  }

  function openCreate() {
    dialog.replace(() => (
      <DialogDeploymentCreate useSDK={props.useSDK} onDone={() => void refreshAndReopen()} />
    ))
  }

  function openDetail(item: Deployment) {
    dialog.replace(() => (
      <DialogDeploymentDetail useSDK={props.useSDK} deployment={item} onBack={() => void refreshAndReopen()} />
    ))
  }

  const createRow: DialogSelectOption<Row> = {
    title: "+ New deployment",
    value: { kind: "create" },
  }

  function row(item: Deployment): DialogSelectOption<Row> {
    return {
      title: item.name,
      value: { kind: "open", deployment: item },
      description: `${item.modelName} · ${usd.format(item.costPerHour)}/hr`,
      footer: <span style={{ fg: statusColor(item.status) }}>{item.status}</span>,
    }
  }

  return (
    <DialogSelect
      title="Deployments"
      options={[createRow, ...deployments().map(row)]}
      onSelect={(option) => {
        if (option.value.kind === "create") openCreate()
        else openDetail(option.value.deployment)
      }}
    />
  )
}
