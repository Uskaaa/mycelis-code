/**
 * Mycelis Deployment Detail View
 *
 * mycelis_change - new file. Opened by selecting a deployment in dialog-deployments.tsx instead
 * of that immediately toggling start/stop on Enter. Shows the deployment's status/model/cost and
 * lets the user start, stop, or delete it, then returns to a refreshed list.
 */

import { createSignal, onCleanup, onMount } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { useBindings } from "@tui/keymap"
import { isDeploymentSettled } from "./deployment-status.js"

const POLL_INTERVAL_MS = 5000

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

interface DialogDeploymentDetailProps {
  useSDK: () => UseSDK
  deployment: Deployment
  onBack: () => void
}

export function DialogDeploymentDetail(props: DialogDeploymentDetailProps) {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const sdk = props.useSDK()
  const [status, setStatus] = createSignal(props.deployment.status)
  const [busy, setBusy] = createSignal(false)

  // mycelis_change - lets backspace (the key right above enter) back out to the list, matching
  // dialog-process-list.tsx's back binding, instead of only the "← Back to list" row.
  useBindings(() => ({
    bindings: [{ key: "backspace", desc: "Back", group: "Deployment", cmd: () => !busy() && props.onBack() }],
  }))

  function statusColor(value: string) {
    if (value === "Running") return theme.success
    if (value === "Error") return theme.error
    return theme.textMuted
  }

  // mycelis_change start - a deployment can take minutes to provision or stop, with no push/SSE
  // status update - poll this one deployment while it's still transitioning (e.g. the user opened
  // detail on an already-pending deployment and stayed here), and stop once it settles.
  let pollTimer: ReturnType<typeof setInterval> | undefined

  function stopPoll() {
    if (!pollTimer) return
    clearInterval(pollTimer)
    pollTimer = undefined
  }

  function schedulePoll() {
    if (pollTimer) return
    if (isDeploymentSettled(status())) return
    pollTimer = setInterval(async () => {
      try {
        const response = await sdk.client.kilo.deployments.list()
        const found = ((response?.data as Deployment[]) ?? []).find((d) => d.id === props.deployment.id)
        if (!found) return stopPoll()
        setStatus(found.status)
        if (isDeploymentSettled(found.status)) stopPoll()
      } catch {
        // A transient failure shouldn't stop status updates - just retry next tick.
      }
    }, POLL_INTERVAL_MS)
  }

  onMount(schedulePoll)
  onCleanup(stopPoll)
  // mycelis_change end

  async function toggle() {
    if (busy()) return
    setBusy(true)
    const isRunning = status() === "Running"
    const result = await (isRunning
      ? sdk.client.kilo.deployments.stop({ id: props.deployment.id })
      : sdk.client.kilo.deployments.start({ id: props.deployment.id })
    ).catch((error: unknown) => ({ error }))
    setBusy(false)
    if ((result as any).error) {
      toast.show({ message: `Failed to ${isRunning ? "stop" : "start"} deployment`, variant: "error" })
      return
    }
    // mycelis_change - "Starting"/"Stopping" rather than "Running"/"Stopped": the request was only
    // just accepted, the real status takes a moment to catch up (the list polls for it next).
    setStatus(isRunning ? "Stopping" : "Starting")
    toast.show({ message: isRunning ? "Stopping..." : "Starting...", variant: "success" })
    props.onBack()
  }

  async function remove() {
    if (busy()) return
    const confirmed = await DialogConfirm.show(
      dialog,
      "Delete Deployment?",
      `This permanently deletes "${props.deployment.name}" and its infrastructure. This cannot be undone.`,
    )
    if (confirmed !== true) return
    setBusy(true)
    const result = await sdk.client.kilo.deployments.delete({ id: props.deployment.id }).catch((error: unknown) => ({ error }))
    setBusy(false)
    if ((result as any).error) {
      toast.show({ message: "Failed to delete deployment", variant: "error" })
      return
    }
    toast.show({ message: `Deleted "${props.deployment.name}"`, variant: "success" })
    props.onBack()
  }

  return (
    <DialogSelect
      title={props.deployment.name}
      titleView={
        <box flexDirection="column">
          <box flexDirection="row" gap={1}>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              {props.deployment.name}
            </text>
            {/* mycelis_change - a <span> needs a <text> parent, not a <box> sibling of one -
            this crashed the whole TUI session ("orphan text error") until wrapped. */}
            <text>
              <span style={{ fg: statusColor(status()) }}>{status()}</span>
            </text>
          </box>
          <text fg={theme.textMuted}>
            {props.deployment.modelName} · {usd.format(props.deployment.costPerHour)}/hr
          </text>
        </box>
      }
      locked={busy()}
      renderFilter={false}
      options={[
        {
          title: status() === "Running" ? "Stop deployment" : "Start deployment",
          value: "toggle" as const,
        },
        { title: "Delete deployment", value: "delete" as const },
        { title: "← Back to list", value: "back" as const },
      ]}
      onSelect={(option) => {
        if (option.value === "toggle") void toggle()
        else if (option.value === "delete") void remove()
        else props.onBack()
      }}
    />
  )
}
