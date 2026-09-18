import { Button } from "@kilocode/kilo-ui/button"
import { Card } from "@kilocode/kilo-ui/card"
import { ProviderIcon } from "@kilocode/kilo-ui/provider-icon"
import { Tag } from "@kilocode/kilo-ui/tag"
import { Component, Show, createMemo } from "solid-js"
import { useLanguage } from "../../context/language"
import { useProvider } from "../../context/provider"
import { useServer } from "../../context/server"
import { providerIcon } from "./provider-catalog"
import { KILO_PROVIDER_ID } from "../../../../src/shared/provider-model"

// mycelis_change - Mycelis is the only supported sign-in path: this tab used to also list
// connected/popular BYOK providers, a custom-provider entry, a "browse all providers" catalog
// dialog, and a disabled-providers section. Nothing downstream was deleted (ProviderConnectDialog
// is still used by the chat error-recovery flow in ErrorDisplay.tsx; ProviderSelectDialog and
// CustomProviderDialog remain importable) - only this tab's own BYOK sections and their
// now-unused local helpers were removed. Restoring them is a matter of bringing that JSX back.
const ProvidersTab: Component = () => {
  const provider = useProvider()
  const language = useLanguage()
  const server = useServer()

  const kiloLoggedIn = createMemo(() => !!provider.authStates()[KILO_PROVIDER_ID])

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
            <Tag>{language.t("settings.providers.tag.gateway")}</Tag>
          </Show>
        </div>
      </Card>
    </div>
  )
}

export default ProvidersTab
