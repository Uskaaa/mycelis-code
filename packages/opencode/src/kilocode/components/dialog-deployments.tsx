/**
 * Mycelis Deployments Overview
 *
 * mycelis_change - new file. Compact list of the active workspace's deployments (see
 * DeploymentsController/DeploymentsProxyController in orchestration) with start/stop/delete, plus
 * an action to launch the create flow (dialog-deployment-create.tsx).
 */

import { createSignal, Show } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogDeploymentCreate } from "./dialog-deployment-create.js"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any

interface Deployment {
  id: string
  name: string
  modelName: string
  status: string
  costPerHour: number
}

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
  const [busy, setBusy] = createSignal(false)
  let refreshInFlight = false // mycelis_change - guard against re-entrant/duplicate refresh() calls

  // mycelis_change - only called explicitly after a mutating action (toggle/delete/create), never
  // from onMount - see the initialDeployments note above.
  async function refresh() {
    if (refreshInFlight) return
    refreshInFlight = true
    try {
      const response = await sdk.client.kilo.deployments.list()
      if (response.error || !response.data) {
        const err = response.error as { error?: string } | undefined
        toast.show({ message: err?.error ?? "Failed to refresh deployments", variant: "error" })
        return
      }
      setDeployments(response.data as Deployment[])
    } catch (error) {
      toast.show({ message: `Failed to refresh deployments: ${error}`, variant: "error" })
    } finally {
      refreshInFlight = false
    }
  }

  function statusColor(status: string) {
    if (status === "Running") return theme.success
    if (status === "Error") return theme.error
    return theme.textMuted
  }

  function row(item: Deployment): DialogSelectOption<string> {
    return {
      title: item.name,
      value: item.id,
      description: `${item.modelName} · ${usd.format(item.costPerHour)}/hr`,
      footer: <span style={{ fg: statusColor(item.status) }}>{item.status}</span>,
    }
  }

  function openCreate() {
    dialog.replace(() => (
      <DialogDeploymentCreate
        useSDK={props.useSDK}
        onDone={() => {
          // mycelis_change - re-fetch here (a single explicit call, not onMount) before reopening
          // so the newly created deployment shows up immediately.
          void sdk.client.kilo.deployments
            .list()
            .then((response: any) =>
              dialog.replace(() => (
                <DialogDeployments useSDK={props.useSDK} initialDeployments={response.data ?? []} />
              )),
            )
            .catch(() => dialog.replace(() => <DialogDeployments useSDK={props.useSDK} initialDeployments={[]} />))
        }}
      />
    ))
  }

  async function toggle(id: string) {
    if (busy()) return
    const item = deployments().find((d) => d.id === id)
    if (!item) return
    setBusy(true)
    const isRunning = item.status === "Running"
    const result = await (isRunning
      ? sdk.client.kilo.deployments.stop({ id })
      : sdk.client.kilo.deployments.start({ id })
    ).catch((error: unknown) => ({ error }))
    setBusy(false)
    if ((result as any).error) {
      toast.show({ message: `Failed to ${isRunning ? "stop" : "start"} deployment`, variant: "error" })
    }
    await refresh()
  }

  async function remove(id: string) {
    if (busy()) return
    const item = deployments().find((d) => d.id === id)
    if (!item) return
    const confirmed = await DialogConfirm.show(
      dialog,
      "Delete Deployment?",
      `This permanently deletes "${item.name}" and its infrastructure. This cannot be undone.`,
    )
    if (confirmed !== true) return
    setBusy(true)
    const result = await sdk.client.kilo.deployments.delete({ id }).catch((error: unknown) => ({ error }))
    setBusy(false)
    if ((result as any).error) {
      toast.show({ message: "Failed to delete deployment", variant: "error" })
    } else {
      toast.show({ message: `Deleted "${item.name}"`, variant: "success" })
    }
    await refresh()
  }

  return (
    <Show
      when={deployments().length > 0}
      fallback={
        <DialogAlert
          title="No Deployments"
          message={"You don't have any deployments in this workspace yet.\nPress enter to create one."}
          onConfirm={openCreate}
        />
      }
    >
      <DialogSelect
        title="Deployments"
        options={deployments().map(row)}
        actions={[
          {
            title: "toggle start/stop",
            command: "deployments.toggle",
            hidden: busy(),
            onTrigger: (item) => void toggle(item.value),
          },
          {
            title: "delete",
            command: "deployments.delete",
            hidden: busy(),
            onTrigger: (item) => void remove(item.value),
          },
          {
            title: "create",
            command: "deployments.create",
            hidden: busy(),
            onTrigger: openCreate,
          },
        ]}
        onSelect={(item) => void toggle(item.value)}
      />
    </Show>
  )
}
