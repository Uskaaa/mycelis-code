// mycelis_change - new file
import { Component, Show } from "solid-js"
import { List } from "@kilocode/kilo-ui/list"
import { Tag } from "@kilocode/kilo-ui/tag"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import { useLanguage } from "../../context/language"
import { useDeployments } from "../../context/deployments"
import type { Deployment } from "../../types/messages"
import DeploymentCreateDialog from "./DeploymentCreateDialog"
import DeploymentDetailDialog from "./DeploymentDetailDialog"

function statusKey(status: string): "running" | "stopped" | "error" {
  const s = status.toLowerCase()
  if (s === "running") return "running"
  if (s === "error") return "error"
  return "stopped"
}

function formatCost(costPerHour: number): string {
  return `$${costPerHour.toFixed(2)}/hr`
}

const DeploymentsTab: Component = () => {
  const language = useLanguage()
  const deployments = useDeployments()
  const dialog = useDialog()

  const openCreate = () => {
    dialog.show(() => <DeploymentCreateDialog />)
  }

  const openDetail = (deployment: Deployment) => {
    dialog.show(() => <DeploymentDetailDialog deployment={deployment} />)
  }

  return (
    <Show when={!deployments.loading()} fallback={<Spinner />}>
      <List
        items={deployments.deployments()}
        key={(d) => d.id}
        onSelect={(d) => d && openDetail(d)}
        emptyMessage={language.t("settings.deployments.empty")}
        add={{
          render: () => (
            <button
              type="button"
              onClick={openCreate}
              data-slot="list-item"
              style={{ display: "flex", "align-items": "center", gap: "6px", width: "100%" }}
            >
              <Icon name="plus" />
              {language.t("settings.deployments.new")}
            </button>
          ),
        }}
      >
        {(d) => (
          <div style={{ display: "flex", "flex-direction": "column", gap: "2px", "text-align": "left" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <span>{d.name}</span>
              <Tag data-status={statusKey(d.status)}>{d.status}</Tag>
            </div>
            <span style={{ color: "var(--vscode-descriptionForeground)", "font-size": "12px" }}>
              {d.modelName} · {formatCost(d.costPerHour)}
            </span>
          </div>
        )}
      </List>
    </Show>
  )
}

export default DeploymentsTab
