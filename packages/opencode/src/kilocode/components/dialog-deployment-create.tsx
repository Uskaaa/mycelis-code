/**
 * Mycelis Deployment Creation Flow
 *
 * mycelis_change - rewritten as a proper multi-step wizard (see DeploymentWizard.razor in
 * orchestration) with a visible step indicator in every screen's title, matching the web
 * dashboard's core options: model, name, concurrent users, auto-stop-on-inactivity, and Web-UI
 * visibility. HuggingFace import, LoRA fine-tuning, and custom (daily/one-time) scheduling stay
 * out of the CLI wizard for now - see that file for the full option set this doesn't replicate.
 * There's no "back" between steps: Escape abandons the wizard and returns to the deployments
 * list, same as every step already did before this rewrite.
 */

import { createSignal, onMount } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { DialogAlert } from "@tui/ui/dialog-alert"

// These types are OpenCode-internal and imported at runtime
type UseSDK = any

interface DialogDeploymentCreateProps {
  useSDK: () => UseSDK
  onDone: () => void
}

const TOTAL_STEPS = 6

function stepTitle(step: number, label: string) {
  return `Step ${step}/${TOTAL_STEPS} · ${label}`
}

interface WizardState {
  modelId: string
  modelName: string
  name: string
  maxConcurrentUsers: number
  autoStopOnInactivity: boolean
  inactivityTimeoutMinutes: number
  isExposedToWebUi: boolean
}

export function DialogDeploymentCreate(props: DialogDeploymentCreateProps) {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()
  const sdk = props.useSDK()
  const [busy, setBusy] = createSignal(false)

  async function pickModel() {
    let response: any
    try {
      response = await sdk.client.kilo.deployments.marketplaceModels()
    } catch (error) {
      // mycelis_change - an unguarded throw here used to leave this dialog stuck on the initial
      // "Loading" alert forever with no feedback. Always land on something dismissable.
      dialog.replace(() => (
        <DialogAlert title="Error" message={`Failed to load marketplace models: ${error}`} onConfirm={props.onDone} />
      ))
      return
    }
    if (response.error || !response.data) {
      dialog.replace(() => (
        <DialogAlert title="Error" message="Failed to load marketplace models." onConfirm={props.onDone} />
      ))
      return
    }
    const models = response.data as Array<{ id: string; name: string; provider: string; vramRequiredGb: number }>
    if (models.length === 0) {
      dialog.replace(() => (
        <DialogAlert
          title="No Models Available"
          message="No open-source models are available to deploy."
          onConfirm={props.onDone}
        />
      ))
      return
    }

    dialog.replace(() => (
      <DialogSelect
        title={stepTitle(1, "Choose a model to deploy")}
        options={models.map((model) => ({
          title: model.name,
          value: model.id,
          description: `${model.provider} · ${model.vramRequiredGb}GB VRAM`,
        }))}
        onSelect={(option: any) =>
          promptName({
            modelId: option.value,
            modelName: models.find((m) => m.id === option.value)?.name ?? option.value,
          })
        }
      />
    ))
  }

  function promptName(state: Pick<WizardState, "modelId" | "modelName">) {
    dialog.replace(() => (
      <DialogPrompt
        title={stepTitle(2, `Name this deployment (${state.modelName})`)}
        placeholder="e.g. Marketing Bot"
        onConfirm={(value) => {
          const name = value.trim()
          if (!name) {
            toast.show({ message: "Name is required", variant: "error" })
            promptName(state)
            return
          }
          promptConcurrentUsers({ ...state, name })
        }}
        onCancel={props.onDone}
      />
    ))
  }

  function promptConcurrentUsers(state: Pick<WizardState, "modelId" | "modelName" | "name">) {
    dialog.replace(() => (
      <DialogPrompt
        title={stepTitle(3, "Concurrent users (1-50)")}
        description={() => (
          <text fg={theme.textMuted}>Determines the GPU size reserved for this deployment.</text>
        )}
        value="5"
        onConfirm={(value) => {
          const parsed = Number.parseInt(value.trim(), 10)
          if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
            toast.show({ message: "Enter a whole number between 1 and 50", variant: "error" })
            promptConcurrentUsers(state)
            return
          }
          void promptAutoStop({ ...state, maxConcurrentUsers: parsed })
        }}
        onCancel={props.onDone}
      />
    ))
  }

  async function promptAutoStop(state: Pick<WizardState, "modelId" | "modelName" | "name" | "maxConcurrentUsers">) {
    const enable = await DialogConfirm.show(
      dialog,
      stepTitle(4, "Auto-stop on inactivity?"),
      "Stop the deployment automatically when nobody is using it. Saves cost while idle.",
    )
    if (enable === undefined) {
      props.onDone()
      return
    }
    if (!enable) {
      void promptWebUi({ ...state, autoStopOnInactivity: false, inactivityTimeoutMinutes: 30 })
      return
    }
    promptInactivityMinutes(state)
  }

  function promptInactivityMinutes(state: Pick<WizardState, "modelId" | "modelName" | "name" | "maxConcurrentUsers">) {
    dialog.replace(() => (
      <DialogPrompt
        title={stepTitle(4, "Stop after how many minutes of inactivity?")}
        value="30"
        onConfirm={(value) => {
          const parsed = Number.parseInt(value.trim(), 10)
          if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1440) {
            toast.show({ message: "Enter a whole number of minutes between 1 and 1440 (24h)", variant: "error" })
            promptInactivityMinutes(state)
            return
          }
          void promptWebUi({ ...state, autoStopOnInactivity: true, inactivityTimeoutMinutes: parsed })
        }}
        onCancel={props.onDone}
      />
    ))
  }

  async function promptWebUi(
    state: Pick<
      WizardState,
      "modelId" | "modelName" | "name" | "maxConcurrentUsers" | "autoStopOnInactivity" | "inactivityTimeoutMinutes"
    >,
  ) {
    const expose = await DialogConfirm.show(
      dialog,
      stepTitle(5, "Show in workspace Web-UI?"),
      "If shown, this model appears in the workspace Web-UI's model dropdown and users can chat with it directly. If not, it's only reachable via API.",
    )
    if (expose === undefined) {
      props.onDone()
      return
    }
    void confirmCreate({ ...state, isExposedToWebUi: expose })
  }

  async function confirmCreate(state: WizardState) {
    setBusy(true)
    const estimateResponse = await sdk.client.kilo.deployments.gpuEstimate({ modelId: state.modelId }).catch(() => undefined)
    setBusy(false)
    const estimate = estimateResponse?.data as
      | { gpuName?: string; costPerHourUsd?: number; memoryInGb?: number }
      | undefined

    const costLine =
      estimate?.costPerHourUsd !== undefined
        ? `Estimated cost: $${estimate.costPerHourUsd.toFixed(2)}/hr (${estimate.gpuName ?? "GPU"})`
        : "Estimated cost: unavailable"
    const autoStopLine = state.autoStopOnInactivity
      ? `Auto-stop: after ${state.inactivityTimeoutMinutes}min idle`
      : "Auto-stop: off"

    const confirmed = await DialogConfirm.show(
      dialog,
      stepTitle(6, "Review & Deploy"),
      `Name: ${state.name}\nModel: ${state.modelName}\nConcurrent users: ${state.maxConcurrentUsers}\n${autoStopLine}\nWeb-UI: ${
        state.isExposedToWebUi ? "visible" : "API only"
      }\n${costLine}\n\nDeploy now?`,
    )
    if (confirmed !== true) {
      props.onDone()
      return
    }

    setBusy(true)
    const result = await sdk.client.kilo.deployments
      .create({
        name: state.name,
        modelId: state.modelId,
        maxConcurrentUsers: state.maxConcurrentUsers,
        autoStopOnInactivity: state.autoStopOnInactivity,
        inactivityTimeoutMinutes: state.inactivityTimeoutMinutes,
        isExposedToWebUi: state.isExposedToWebUi,
      })
      .catch((error: unknown) => ({ error }))
    setBusy(false)

    if ((result as any).error) {
      const err = (result as any).error as { error?: string } | undefined
      toast.show({ message: err?.error ?? "Failed to create deployment", variant: "error" })
      props.onDone()
      return
    }

    toast.show({ message: `Deploying "${state.name}"...`, variant: "success" })
    props.onDone()
  }

  // Kick off the flow as soon as this component mounts.
  onMount(() => {
    pickModel().catch((error) => {
      toast.show({ message: `Failed to load marketplace models: ${error}`, variant: "error" })
      props.onDone()
    })
  })

  return (
    <DialogAlert
      title="Loading"
      message={busy() ? "Working..." : "Loading marketplace models..."}
    />
  )
}
