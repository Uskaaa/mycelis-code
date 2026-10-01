// mycelis_change - new file
import { Component, Show, createSignal, createEffect } from "solid-js"
import { Dialog } from "@kilocode/kilo-ui/dialog"
import { Button } from "@kilocode/kilo-ui/button"
import { Tag } from "@kilocode/kilo-ui/tag"
import { showToast } from "@kilocode/kilo-ui/toast"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import { useLanguage } from "../../context/language"
import { useDeployments } from "../../context/deployments"
import type { Deployment } from "../../types/messages"

function statusKey(status: string): "running" | "stopped" | "error" {
  const s = status.toLowerCase()
  if (s === "running") return "running"
  if (s === "error") return "error"
  return "stopped"
}

interface DeploymentDetailDialogProps {
  deployment: Deployment
}

const DeploymentDetailDialog: Component<DeploymentDetailDialogProps> = (props) => {
  const language = useLanguage()
  const deployments = useDeployments()
  const dialog = useDialog()
  const [status, setStatus] = createSignal(props.deployment.status)
  const [busy, setBusy] = createSignal(false)
  const [confirmDelete, setConfirmDelete] = createSignal(false)

  // mycelis_change - the deployments context polls the list while anything is transitioning (see
  // context/deployments.tsx); pick up that live status instead of staying stuck on the snapshot
  // this dialog was opened with.
  createEffect(() => {
    const found = deployments.deployments().find((d) => d.id === props.deployment.id)
    if (found) setStatus(found.status)
  })

  const running = () => status().toLowerCase() === "running"

  const toggle = async () => {
    setBusy(true)
    try {
      if (running()) {
        await deployments.stop(props.deployment.id)
        // mycelis_change - "Stopping", not "Stopped": the request was only just accepted, the
        // real status takes a moment to catch up (the context's poll picks it up from here).
        setStatus("Stopping")
        showToast({
          variant: "success",
          title: language.t("settings.deployments.detail.stopping", { name: props.deployment.name }),
        })
      } else {
        await deployments.start(props.deployment.id)
        setStatus("Starting") // mycelis_change - see "Stopping" note above
        showToast({
          variant: "success",
          title: language.t("settings.deployments.detail.starting", { name: props.deployment.name }),
        })
      }
      dialog.close()
    } catch (err) {
      showToast({ variant: "error", title: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deployments.remove(props.deployment.id)
      showToast({
        variant: "success",
        title: language.t("settings.deployments.detail.deleted", { name: props.deployment.name }),
      })
      dialog.close()
    } catch (err) {
      showToast({ variant: "error", title: err instanceof Error ? err.message : String(err) })
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={props.deployment.name}
      description={`${props.deployment.modelName} · $${props.deployment.costPerHour.toFixed(2)}/hr`}
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <Tag data-status={statusKey(status())}>{status()}</Tag>

        <Show
          when={!confirmDelete()}
          fallback={
            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <p style={{ margin: 0, "font-size": "var(--kilo-font-size-13)" }}>
                {language.t("settings.deployments.detail.confirmDelete", { name: props.deployment.name })}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy()}>
                  {language.t("common.cancel")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={remove}
                  disabled={busy()}
                  style={{ color: "var(--vscode-errorForeground)" }}
                >
                  {language.t("settings.deployments.detail.delete")}
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="secondary" onClick={toggle} disabled={busy()}>
              {running()
                ? language.t("settings.deployments.detail.stop")
                : language.t("settings.deployments.detail.start")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={busy()}
              style={{ color: "var(--vscode-errorForeground)" }}
            >
              {language.t("settings.deployments.detail.delete")}
            </Button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}

export default DeploymentDetailDialog
