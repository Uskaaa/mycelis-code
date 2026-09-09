import type { TuiPlugin, TuiPluginApi } from "@kilocode/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, Show } from "solid-js"
import { abbreviateHome } from "../../runtime"
import { useTuiPaths } from "../../context/runtime"
import { useConnected } from "../../component/use-connected" // mycelis_change

const id = "internal:sidebar-footer"

function View(props: { api: TuiPluginApi; sessionID: string }) {
  const paths = useTuiPaths()
  const theme = () => props.api.theme.current
  const has = useConnected() // mycelis_change - shared Mycelis-specific check (api.state.provider can't tell auth from availability)
  const done = createMemo(() => props.api.kv.get("dismissed_getting_started", false))
  const show = createMemo(() => !has() && !done())
  const path = createMemo(() => {
    const session = props.api.state.session.get(props.sessionID)
    const dir = session?.directory || props.api.state.path.directory || paths.cwd
    const out = abbreviateHome(dir, paths.home)
    const branch = session?.directory === props.api.state.path.directory ? props.api.state.vcs?.branch : undefined
    const text = branch ? out + ":" + branch : out
    const list = text.split("/")
    return {
      parent: list.slice(0, -1).join("/"),
      name: list.at(-1) ?? "",
    }
  })

  return (
    <box gap={1}>
      <Show when={show()}>
        <box
          backgroundColor={theme().backgroundElement}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          flexDirection="row"
          gap={1}
        >
          <text flexShrink={0} fg={theme().text}>
            ⬖
          </text>
          <box flexGrow={1} gap={1}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={theme().text}>
                <b>Getting started</b>
              </text>
              <text fg={theme().textMuted} onMouseDown={() => props.api.kv.set("dismissed_getting_started", true)}>
                ✕
              </text>
            </box>
            {/* mycelis_change */}
            <text fg={theme().textMuted}>Sign in with your Mycelis account to use AI models.</text>
            <text fg={theme().textMuted}>
              Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc
            </text>
            <box flexDirection="row" gap={1} justifyContent="space-between">
              <text fg={theme().text}>Connect provider</text>
              <text fg={theme().textMuted}>/connect</text>
            </box>
          </box>
        </box>
      </Show>
      <text>
        <span style={{ fg: theme().textMuted }}>{path().parent}/</span>
        <span style={{ fg: theme().text }}>{path().name}</span>
      </text>
      {/* mycelis_change - always-visible sign-in state, unlike the dismissible card above */}
      <text fg={theme().textMuted}>
        <Show
          when={has()}
          fallback={
            <>
              <span style={{ fg: theme().warning }}>•</span> <b>Not signed in</b>{" "}
              <span>run /connect to use Mycelis</span>
            </>
          }
        >
          <span style={{ fg: theme().success }}>•</span> <b>Mycelis</b> <span>{props.api.app.version}</span>
        </Show>
      </text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_footer(_ctx, props) {
        return <View api={api} sessionID={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
