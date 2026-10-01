// mycelis_change - new file
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useKV } from "@tui/context/kv"
import { useToast } from "@tui/ui/toast"
import {
  ATTENTION_CUSTOM_SOUND_KV_KEY,
  CUSTOM_SOUND_IDS,
  attentionCustomSoundCategory,
  attentionCustomSoundLabel,
  previewAttentionSound,
} from "@tui/attention"
import { createMemo, onMount } from "solid-js"

/**
 * "/sound" command - picks the sound Kilo plays for every attention event (question, permission,
 * error, done). Mirrors the VS Code and JetBrains notification-sound pickers: one choice applies
 * uniformly to all events, ahead of the CLI's own per-event `attention.sounds` config and sound
 * packs (see `soundCandidates` in `@tui/attention`). Selection is stored in the local KV store
 * (`~/.local/state/kilo/kv.json`), not the static tui.json config file, matching how theme
 * selection already persists (see `context/theme.tsx`).
 */
export function DialogNotificationSound() {
  const dialog = useDialog()
  const kv = useKV()
  const toast = useToast()

  const current = createMemo(() => kv.get(ATTENTION_CUSTOM_SOUND_KV_KEY, "default") as string)

  const options = createMemo<DialogSelectOption<string>[]>(() => [
    { title: "Off", value: "off", category: "" },
    { title: "Default (per event)", value: "default", category: "" },
    ...CUSTOM_SOUND_IDS.map((id) => ({
      title: attentionCustomSoundLabel(id),
      value: id,
      category: attentionCustomSoundCategory(id),
    })),
  ])

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title="Set Notification Sound"
      options={options()}
      current={current()}
      preserveSelection
      onMove={(option) => {
        void previewAttentionSound(option.value)
      }}
      onSelect={(option) => {
        kv.set(ATTENTION_CUSTOM_SOUND_KV_KEY, option.value)
        dialog.clear()
        toast.show({ variant: "info", message: `Notification sound set to ${option.title}` })
      }}
    />
  )
}
