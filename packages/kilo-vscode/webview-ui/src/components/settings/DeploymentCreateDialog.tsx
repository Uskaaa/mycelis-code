// mycelis_change - new file
import { Component, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { Dialog } from "@kilocode/kilo-ui/dialog"
import { Button } from "@kilocode/kilo-ui/button"
import { Select } from "@kilocode/kilo-ui/select"
import { TextField } from "@kilocode/kilo-ui/text-field"
import { Switch } from "@kilocode/kilo-ui/switch"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { showToast } from "@kilocode/kilo-ui/toast"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import { useLanguage } from "../../context/language"
import { useDeployments } from "../../context/deployments"
import type { MarketplaceModel } from "../../types/messages"
import SettingsRow from "./SettingsRow"

const MIN_CONCURRENCY = 1
const MAX_CONCURRENCY = 50
const MIN_TIMEOUT = 1
const MAX_TIMEOUT = 1440
const GPU_ESTIMATE_DEBOUNCE_MS = 400

interface ModelOption {
  value: string
  label: string
  description: string
}

function toOption(m: MarketplaceModel): ModelOption {
  return { value: m.id, label: m.name, description: `${m.provider} · ${m.vramRequiredGb}GB VRAM` }
}

const DeploymentCreateDialog: Component = () => {
  const language = useLanguage()
  const deployments = useDeployments()
  const dialog = useDialog()

  const [models, setModels] = createSignal<MarketplaceModel[]>([])
  const [modelsLoading, setModelsLoading] = createSignal(true)
  const [modelsError, setModelsError] = createSignal<string>()

  const [state, setState] = createStore({
    modelId: "",
    modelName: "",
    name: "",
    maxConcurrentUsers: 5,
    autoStopOnInactivity: false,
    inactivityTimeoutMinutes: 30,
    isExposedToWebUi: false,
    submitting: false,
    nameError: undefined as string | undefined,
    concurrencyError: undefined as string | undefined,
    timeoutError: undefined as string | undefined,
  })

  const [estimate, setEstimate] = createSignal<{ costPerHourUsd?: number; gpuName?: string } | null>(null)
  const [estimateLoading, setEstimateLoading] = createSignal(false)

  onMount(async () => {
    try {
      const result = await deployments.marketplaceModels()
      setModels(result)
      if (result.length === 0) setModelsError(language.t("settings.deployments.create.noModels"))
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : String(err))
    } finally {
      setModelsLoading(false)
    }
  })

  let estimateTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const modelId = state.modelId
    const concurrency = state.maxConcurrentUsers
    if (!modelId) {
      setEstimate(null)
      return
    }
    if (estimateTimer) clearTimeout(estimateTimer)
    estimateTimer = setTimeout(async () => {
      setEstimateLoading(true)
      try {
        const result = await deployments.gpuEstimate(modelId, concurrency)
        setEstimate(result)
      } finally {
        setEstimateLoading(false)
      }
    }, GPU_ESTIMATE_DEBOUNCE_MS)
  })
  onCleanup(() => {
    if (estimateTimer) clearTimeout(estimateTimer)
  })

  const modelOptions = () => models().map(toOption)
  const selectedModel = () => modelOptions().find((o) => o.value === state.modelId)

  const selectModel = (option: ModelOption | undefined) => {
    if (!option) return
    setState({ modelId: option.value, modelName: option.label })
  }

  const validate = (): boolean => {
    let ok = true
    if (!state.name.trim()) {
      setState("nameError", language.t("settings.deployments.create.nameRequired"))
      ok = false
    } else {
      setState("nameError", undefined)
    }
    if (
      !Number.isFinite(state.maxConcurrentUsers) ||
      state.maxConcurrentUsers < MIN_CONCURRENCY ||
      state.maxConcurrentUsers > MAX_CONCURRENCY
    ) {
      setState("concurrencyError", language.t("settings.deployments.create.concurrencyInvalid"))
      ok = false
    } else {
      setState("concurrencyError", undefined)
    }
    if (
      state.autoStopOnInactivity &&
      (!Number.isFinite(state.inactivityTimeoutMinutes) ||
        state.inactivityTimeoutMinutes < MIN_TIMEOUT ||
        state.inactivityTimeoutMinutes > MAX_TIMEOUT)
    ) {
      setState("timeoutError", language.t("settings.deployments.create.timeoutInvalid"))
      ok = false
    } else {
      setState("timeoutError", undefined)
    }
    return ok
  }

  const submit = async () => {
    if (!state.modelId) return
    if (!validate()) return
    setState("submitting", true)
    try {
      await deployments.create({
        name: state.name.trim(),
        modelId: state.modelId,
        maxConcurrentUsers: state.maxConcurrentUsers,
        autoStopOnInactivity: state.autoStopOnInactivity,
        inactivityTimeoutMinutes: state.autoStopOnInactivity ? state.inactivityTimeoutMinutes : undefined,
        isExposedToWebUi: state.isExposedToWebUi,
      })
      showToast({
        variant: "success",
        title: language.t("settings.deployments.create.deploying", { name: state.name.trim() }),
      })
      dialog.close()
    } catch (err) {
      showToast({ variant: "error", title: err instanceof Error ? err.message : String(err) })
      setState("submitting", false)
    }
  }

  return (
    <Dialog title={language.t("settings.deployments.create.title")} size="large">
      <Show when={!modelsLoading()} fallback={<Spinner />}>
        <Show when={!modelsError()} fallback={<p role="alert">{modelsError()}</p>}>
          <div style={{ display: "flex", "flex-direction": "column" }}>
            <SettingsRow title={language.t("settings.deployments.create.model")}>
              <Select
                options={modelOptions()}
                current={selectedModel()}
                value={(o: ModelOption) => o.value}
                label={(o: ModelOption) => o.label}
                onSelect={selectModel}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>

            <SettingsRow title={language.t("settings.deployments.create.name")}>
              <TextField
                value={state.name}
                onChange={(v) => setState({ name: v, nameError: undefined })}
                error={state.nameError}
                placeholder={language.t("settings.deployments.create.namePlaceholder")}
                hideLabel
                label={language.t("settings.deployments.create.name")}
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.deployments.create.concurrency")}
              description={language.t("settings.deployments.create.concurrencyDescription")}
            >
              <TextField
                type="number"
                value={String(state.maxConcurrentUsers)}
                onChange={(v) => setState({ maxConcurrentUsers: Number.parseInt(v, 10), concurrencyError: undefined })}
                error={state.concurrencyError}
                hideLabel
                label={language.t("settings.deployments.create.concurrency")}
              />
            </SettingsRow>

            <SettingsRow title={language.t("settings.deployments.create.autoStop")}>
              <Switch
                checked={state.autoStopOnInactivity}
                onChange={(checked: boolean) => setState("autoStopOnInactivity", checked)}
                hideLabel
              >
                {language.t("settings.deployments.create.autoStop")}
              </Switch>
            </SettingsRow>

            <Show when={state.autoStopOnInactivity}>
              <SettingsRow title={language.t("settings.deployments.create.timeout")}>
                <TextField
                  type="number"
                  value={String(state.inactivityTimeoutMinutes)}
                  onChange={(v) =>
                    setState({ inactivityTimeoutMinutes: Number.parseInt(v, 10), timeoutError: undefined })
                  }
                  error={state.timeoutError}
                  hideLabel
                  label={language.t("settings.deployments.create.timeout")}
                />
              </SettingsRow>
            </Show>

            <SettingsRow
              title={language.t("settings.deployments.create.exposeToWebUi")}
              description={language.t("settings.deployments.create.exposeToWebUiDescription")}
              last
            >
              <Switch
                checked={state.isExposedToWebUi}
                onChange={(checked: boolean) => setState("isExposedToWebUi", checked)}
                hideLabel
              >
                {language.t("settings.deployments.create.exposeToWebUi")}
              </Switch>
            </SettingsRow>

            <div
              style={{
                "margin-top": "12px",
                "font-size": "var(--kilo-font-size-12)",
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              <Show when={!estimateLoading()} fallback={language.t("settings.deployments.create.estimating")}>
                <Show when={estimate()} fallback={language.t("settings.deployments.create.estimateUnavailable")}>
                  {(e) => (
                    <span>
                      {language.t("settings.deployments.create.estimatedCost", {
                        cost: e().costPerHourUsd != null ? `$${e().costPerHourUsd!.toFixed(2)}/hr` : "?",
                        gpu: e().gpuName ?? "",
                      })}
                    </span>
                  )}
                </Show>
              </Show>
            </div>

            <div style={{ display: "flex", "justify-content": "flex-end", gap: "8px", "margin-top": "16px" }}>
              <Button variant="ghost" onClick={() => dialog.close()} disabled={state.submitting}>
                {language.t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={submit} disabled={state.submitting || !state.modelId}>
                {state.submitting ? (
                  <Spinner style={{ width: "14px", height: "14px" }} />
                ) : (
                  language.t("settings.deployments.create.deploy")
                )}
              </Button>
            </div>
          </div>
        </Show>
      </Show>
    </Dialog>
  )
}

export default DeploymentCreateDialog
