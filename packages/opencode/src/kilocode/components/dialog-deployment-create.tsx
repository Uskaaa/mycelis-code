/**
 * Mycelis Deployment Creation Flow
 *
 * mycelis_change - new file. A deliberately small first pass at the web dashboard's
 * DeploymentWizard (see DeploymentWizard.razor in orchestration): pick an open-source marketplace
 * model, name it, review the estimated GPU cost, confirm. No HuggingFace import, LoRA fine-tuning,
 * schedule, or Web-UI visibility step yet - those stay off (Manual schedule, no auto-stop, not
 * exposed to Web-UI) until this grows a second pass.
 */

import { createSignal, onMount } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
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

export function DialogDeploymentCreate(props: DialogDeploymentCreateProps) {
  const dialog = useDialog()
  const toast = useToast()
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
        title="Choose a model to deploy"
        options={models.map((model) => ({
          title: model.name,
          value: model.id,
          description: `${model.provider} · ${model.vramRequiredGb}GB VRAM`,
        }))}
        onSelect={(option: any) => promptName(option.value, models.find((m) => m.id === option.value)?.name ?? option.value)}
      />
    ))
  }

  function promptName(modelId: string, modelName: string) {
    dialog.replace(() => (
      <DialogPrompt
        title={`Name this deployment (${modelName})`}
        placeholder="e.g. Marketing Bot"
        onConfirm={(value) => {
          const name = value.trim()
          if (!name) {
            toast.show({ message: "Name is required", variant: "error" })
            promptName(modelId, modelName)
            return
          }
          void confirmCreate(modelId, modelName, name)
        }}
        onCancel={props.onDone}
      />
    ))
  }

  async function confirmCreate(modelId: string, modelName: string, name: string) {
    setBusy(true)
    const estimateResponse = await sdk.client.kilo.deployments.gpuEstimate({ modelId }).catch(() => undefined)
    setBusy(false)
    const estimate = estimateResponse?.data as
      | { gpuName?: string; costPerHourUsd?: number; memoryInGb?: number }
      | undefined

    const costLine =
      estimate?.costPerHourUsd !== undefined
        ? `Estimated cost: $${estimate.costPerHourUsd.toFixed(2)}/hr (${estimate.gpuName ?? "GPU"})`
        : "Estimated cost: unavailable"

    const confirmed = await DialogConfirm.show(
      dialog,
      "Review & Deploy",
      `Name: ${name}\nModel: ${modelName}\n${costLine}\n\nDeploy now?`,
    )
    if (confirmed !== true) {
      props.onDone()
      return
    }

    setBusy(true)
    const result = await sdk.client.kilo.deployments
      .create({ name, modelId, maxConcurrentUsers: 5 })
      .catch((error: unknown) => ({ error }))
    setBusy(false)

    if ((result as any).error) {
      const err = (result as any).error as { error?: string } | undefined
      toast.show({ message: err?.error ?? "Failed to create deployment", variant: "error" })
      props.onDone()
      return
    }

    toast.show({ message: `Deploying "${name}"...`, variant: "success" })
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
