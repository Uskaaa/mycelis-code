import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { useDialog } from "@kilocode/kilo-ui/context/dialog"
import { ProviderIcon } from "@kilocode/kilo-ui/provider-icon"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { Tag } from "@kilocode/kilo-ui/tag"
import { showToast } from "@kilocode/kilo-ui/toast"
import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useConfig } from "../../context/config"
import { useLanguage } from "../../context/language"
import { useProvider } from "../../context/provider"
import { useServer } from "../../context/server"
import { useVSCode } from "../../context/vscode"
import type { Provider } from "../../types/messages"
import CustomProviderDialog from "./CustomProviderDialog"
import { providerIcon } from "./provider-catalog"
import { isCustomProviderPackage, KILO_PROVIDER_ID } from "../../../../src/shared/provider-model"
import { createProviderAction } from "../../utils/provider-action"

// mycelis_change - Mycelis is the only sign-in path, so this tab dropped the third-party BYOK
// sections (connected/popular providers, "browse all providers" catalog, disabled providers,
// ChatGPT OAuth). Custom providers (self-hosted OpenAI-compatible endpoints added via kilo.json /
// this dialog) are a different, still-supported concept - not a third-party sign-in - so this
// section was restored on its own.
const ProvidersTab: Component = () => {
  const dialog = useDialog()
  const { config } = useConfig()
  const provider = useProvider()
  const language = useLanguage()
  const server = useServer()
  const vscode = useVSCode()
  const action = createProviderAction(vscode)

  onCleanup(action.dispose)

  const kiloLoggedIn = createMemo(() => !!provider.authStates()[KILO_PROVIDER_ID])

  // mycelis_change - logout tears down the shared backend DI graph server-side (global.dispose()),
  // which can take a few seconds. There's no dedicated ack message for it, so treat kiloLoggedIn()
  // flipping to false as "done", with a generous timeout as a safety net against a stuck spinner.
  const [loggingOut, setLoggingOut] = createSignal(false)
  createEffect(() => {
    if (!kiloLoggedIn()) setLoggingOut(false)
  })

  function logout() {
    setLoggingOut(true)
    vscode.postMessage({ type: "logout" })
    setTimeout(() => setLoggingOut(false), 15000)
  }

  const customProviders = createMemo(() => {
    const all = provider.providers()
    return Object.values(all).filter((item): item is Provider => isCustomProviderPackage(config().provider?.[item.id]?.npm))
  })

  function addProvider() {
    dialog.show(() => <CustomProviderDialog />)
  }

  function editProvider(item: Provider) {
    const cfg = config().provider?.[item.id]
    if (!cfg) return
    dialog.show(() => <CustomProviderDialog existing={{ providerID: item.id, name: item.name, config: cfg }} />)
  }

  function removeProvider(item: Provider) {
    action.send(
      { type: "disconnectProvider", providerID: item.id },
      {
        onDisconnected: () => {
          showToast({
            variant: "success",
            icon: "circle-check",
            title: language.t("provider.disconnect.toast.disconnected.title", { provider: item.name }),
          })
        },
        onError: (message) => {
          showToast({ title: language.t("common.requestFailed"), description: message.message })
        },
      },
    )
  }

  return (
    <div>
      <Card>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "12px",
            "min-height": "56px",
            padding: "12px 0",
          }}
        >
          <ProviderIcon id={providerIcon(KILO_PROVIDER_ID)} width={20} height={20} />
          <span
            style={{
              "font-size": "var(--kilo-font-size-14)",
              "font-weight": "500",
              color: "var(--vscode-foreground)",
            }}
          >
            Mycelis
          </span>
          <Show
            when={kiloLoggedIn()}
            fallback={
              <Button size="small" variant="secondary" onClick={() => server.goToLogin()}>
                {language.t("common.signIn")}
              </Button>
            }
          >
            <Button
              size="small"
              variant="ghost"
              onClick={logout}
              disabled={loggingOut()}
              style={{ color: "var(--vscode-errorForeground)" }}
            >
              <Show when={loggingOut()} fallback={language.t("profile.action.logout")}>
                <Spinner style={{ width: "14px", height: "14px" }} />
              </Show>
            </Button>
          </Show>
        </div>
      </Card>

      {/* mycelis_change - custom providers section */}
      <h4 style={{ "margin-top": "16px", "margin-bottom": "8px" }}>
        {language.t("settings.providers.section.custom")}
      </h4>
      <Card>
        <Show
          when={customProviders().length > 0}
          fallback={
            <div
              style={{
                padding: "16px 0",
                "font-size": "var(--kilo-font-size-14)",
                color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
              }}
            >
              {language.t("settings.providers.custom.empty")}
            </div>
          }
        >
          <For each={customProviders()}>
            {(item) => (
              <div
                style={{
                  display: "flex",
                  "flex-wrap": "wrap",
                  "align-items": "center",
                  "justify-content": "space-between",
                  gap: "16px",
                  "min-height": "56px",
                  padding: "12px 0",
                  "border-bottom": "1px solid var(--border-weak-base)",
                }}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "12px", "min-width": 0 }}>
                  <ProviderIcon id={providerIcon(item)} width={20} height={20} />
                  <span
                    style={{
                      "font-size": "var(--kilo-font-size-14)",
                      "font-weight": "500",
                      color: "var(--vscode-foreground)",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                    }}
                  >
                    {item.name}
                  </span>
                  <Tag>{language.t("settings.providers.tag.custom")}</Tag>
                </div>
                <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <Button size="large" variant="ghost" onClick={() => editProvider(item)}>
                    {language.t("provider.custom.edit.title")}
                  </Button>
                  <Button size="large" variant="ghost" onClick={() => removeProvider(item)}>
                    {language.t("common.delete")}
                  </Button>
                </div>
              </div>
            )}
          </For>
        </Show>

        <div
          style={{
            display: "flex",
            "justify-content": "flex-end",
            "padding-top": "12px",
          }}
        >
          <Button size="small" variant="secondary" icon="plus-small" onClick={addProvider}>
            {language.t("provider.custom.title")}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default ProvidersTab
