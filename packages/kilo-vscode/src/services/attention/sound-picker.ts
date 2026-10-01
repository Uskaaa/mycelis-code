import * as vscode from "vscode"
import { CustomSoundIDs } from "./sound"
import { previewSound } from "./service"
import { t } from "../i18n"

type Item = vscode.QuickPickItem & { id: string }

/** "bip-bop-03" -> "Bip-Bop 03"; "alert-01" -> "Alert 01". */
function labelFor(id: string): string {
  if (id === "default") return t("kilocode:attention.sound.default")
  if (id === "system") return t("kilocode:attention.sound.system")
  const parts = id.split("-")
  const num = parts.pop()
  const name = parts.map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`).join("-")
  return `${name} ${num}`
}

/**
 * Native VS Code command (Command Palette: "Mycelis: Set Notification Sound") for picking the
 * sound Kilo plays when a session finishes or needs your input. Mirrors the choice already in
 * Settings -> Notifications, as a faster, more discoverable entry point - a QuickPick instead of
 * navigating into settings, with a per-item play button so a sound can be previewed before it's
 * committed. Selecting one updates the same `kilo-code.new.attention.sound` setting.
 */
export async function pickNotificationSound(): Promise<void> {
  const config = vscode.workspace.getConfiguration("kilo-code.new.attention")
  const current = config.get<string>("sound", "default")
  const playIcon = new vscode.ThemeIcon("play")
  const playTooltip = t("kilocode:attention.sound.preview")

  const ids = ["default", "system", ...CustomSoundIDs]
  const items: Item[] = ids.map((id) => ({
    id,
    label: labelFor(id),
    description: id === current ? t("kilocode:attention.sound.current") : undefined,
    buttons: [{ iconPath: playIcon, tooltip: playTooltip }],
  }))

  const picker = vscode.window.createQuickPick<Item>()
  picker.title = t("kilocode:attention.sound.pickerTitle")
  picker.placeholder = t("kilocode:attention.sound.pickerPlaceholder")
  picker.items = items
  picker.activeItems = items.filter((item) => item.id === current)

  await new Promise<void>((resolve) => {
    picker.onDidTriggerItemButton((event) => previewSound(event.item.id))
    picker.onDidAccept(() => {
      const picked = picker.selectedItems[0]
      picker.hide()
      if (!picked) return
      void config.update("sound", picked.id, vscode.ConfigurationTarget.Global).then(() => previewSound(picked.id))
    })
    picker.onDidHide(() => {
      picker.dispose()
      resolve()
    })
    picker.show()
  })
}
