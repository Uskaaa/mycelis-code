/// <reference path="./audio.d.ts" />
import type {
  TuiAttention,
  TuiAttentionNotifyInput,
  TuiAttentionNotifyResult,
  TuiAttentionNotifySkipReason,
  TuiAttentionWhen,
  TuiKV,
  TuiAttentionSoundName,
  TuiAttentionSoundPack,
  TuiAttentionSoundPackInfo,
} from "@kilocode/plugin/tui"
import { AttentionSoundName, type TuiConfig } from "./config"
import { Schema } from "effect"
import stripAnsi from "strip-ansi"
import * as TuiAudio from "./audio"
// mycelis_change start - full sound catalog for the /sound command (DialogNotificationSound),
// mirroring the VS Code and JetBrains notification-sound pickers.
import s_alert_01 from "@opencode-ai/ui/audio/alert-01.mp3" with { type: "file" }
import s_alert_02 from "@opencode-ai/ui/audio/alert-02.mp3" with { type: "file" }
import s_alert_03 from "@opencode-ai/ui/audio/alert-03.mp3" with { type: "file" }
import s_alert_04 from "@opencode-ai/ui/audio/alert-04.mp3" with { type: "file" }
import s_alert_05 from "@opencode-ai/ui/audio/alert-05.mp3" with { type: "file" }
import s_alert_06 from "@opencode-ai/ui/audio/alert-06.mp3" with { type: "file" }
import s_alert_07 from "@opencode-ai/ui/audio/alert-07.mp3" with { type: "file" }
import s_alert_08 from "@opencode-ai/ui/audio/alert-08.mp3" with { type: "file" }
import s_alert_09 from "@opencode-ai/ui/audio/alert-09.mp3" with { type: "file" }
import s_alert_10 from "@opencode-ai/ui/audio/alert-10.mp3" with { type: "file" }
import s_bip_bop_01 from "@opencode-ai/ui/audio/bip-bop-01.mp3" with { type: "file" }
import s_bip_bop_02 from "@opencode-ai/ui/audio/bip-bop-02.mp3" with { type: "file" }
import s_bip_bop_03 from "@opencode-ai/ui/audio/bip-bop-03.mp3" with { type: "file" }
import s_bip_bop_04 from "@opencode-ai/ui/audio/bip-bop-04.mp3" with { type: "file" }
import s_bip_bop_05 from "@opencode-ai/ui/audio/bip-bop-05.mp3" with { type: "file" }
import s_bip_bop_06 from "@opencode-ai/ui/audio/bip-bop-06.mp3" with { type: "file" }
import s_bip_bop_07 from "@opencode-ai/ui/audio/bip-bop-07.mp3" with { type: "file" }
import s_bip_bop_08 from "@opencode-ai/ui/audio/bip-bop-08.mp3" with { type: "file" }
import s_bip_bop_09 from "@opencode-ai/ui/audio/bip-bop-09.mp3" with { type: "file" }
import s_bip_bop_10 from "@opencode-ai/ui/audio/bip-bop-10.mp3" with { type: "file" }
import s_nope_01 from "@opencode-ai/ui/audio/nope-01.mp3" with { type: "file" }
import s_nope_02 from "@opencode-ai/ui/audio/nope-02.mp3" with { type: "file" }
import s_nope_03 from "@opencode-ai/ui/audio/nope-03.mp3" with { type: "file" }
import s_nope_04 from "@opencode-ai/ui/audio/nope-04.mp3" with { type: "file" }
import s_nope_05 from "@opencode-ai/ui/audio/nope-05.mp3" with { type: "file" }
import s_nope_06 from "@opencode-ai/ui/audio/nope-06.mp3" with { type: "file" }
import s_nope_07 from "@opencode-ai/ui/audio/nope-07.mp3" with { type: "file" }
import s_nope_08 from "@opencode-ai/ui/audio/nope-08.mp3" with { type: "file" }
import s_nope_09 from "@opencode-ai/ui/audio/nope-09.mp3" with { type: "file" }
import s_nope_10 from "@opencode-ai/ui/audio/nope-10.mp3" with { type: "file" }
import s_nope_11 from "@opencode-ai/ui/audio/nope-11.mp3" with { type: "file" }
import s_nope_12 from "@opencode-ai/ui/audio/nope-12.mp3" with { type: "file" }
import s_staplebops_01 from "@opencode-ai/ui/audio/staplebops-01.mp3" with { type: "file" }
import s_staplebops_02 from "@opencode-ai/ui/audio/staplebops-02.mp3" with { type: "file" }
import s_staplebops_03 from "@opencode-ai/ui/audio/staplebops-03.mp3" with { type: "file" }
import s_staplebops_04 from "@opencode-ai/ui/audio/staplebops-04.mp3" with { type: "file" }
import s_staplebops_05 from "@opencode-ai/ui/audio/staplebops-05.mp3" with { type: "file" }
import s_staplebops_06 from "@opencode-ai/ui/audio/staplebops-06.mp3" with { type: "file" }
import s_staplebops_07 from "@opencode-ai/ui/audio/staplebops-07.mp3" with { type: "file" }
import s_yup_01 from "@opencode-ai/ui/audio/yup-01.mp3" with { type: "file" }
import s_yup_02 from "@opencode-ai/ui/audio/yup-02.mp3" with { type: "file" }
import s_yup_03 from "@opencode-ai/ui/audio/yup-03.mp3" with { type: "file" }
import s_yup_04 from "@opencode-ai/ui/audio/yup-04.mp3" with { type: "file" }
import s_yup_05 from "@opencode-ai/ui/audio/yup-05.mp3" with { type: "file" }
import s_yup_06 from "@opencode-ai/ui/audio/yup-06.mp3" with { type: "file" }

const CUSTOM_SOUND_FILES: Record<string, string> = {
  "alert-01": s_alert_01,
  "alert-02": s_alert_02,
  "alert-03": s_alert_03,
  "alert-04": s_alert_04,
  "alert-05": s_alert_05,
  "alert-06": s_alert_06,
  "alert-07": s_alert_07,
  "alert-08": s_alert_08,
  "alert-09": s_alert_09,
  "alert-10": s_alert_10,
  "bip-bop-01": s_bip_bop_01,
  "bip-bop-02": s_bip_bop_02,
  "bip-bop-03": s_bip_bop_03,
  "bip-bop-04": s_bip_bop_04,
  "bip-bop-05": s_bip_bop_05,
  "bip-bop-06": s_bip_bop_06,
  "bip-bop-07": s_bip_bop_07,
  "bip-bop-08": s_bip_bop_08,
  "bip-bop-09": s_bip_bop_09,
  "bip-bop-10": s_bip_bop_10,
  "nope-01": s_nope_01,
  "nope-02": s_nope_02,
  "nope-03": s_nope_03,
  "nope-04": s_nope_04,
  "nope-05": s_nope_05,
  "nope-06": s_nope_06,
  "nope-07": s_nope_07,
  "nope-08": s_nope_08,
  "nope-09": s_nope_09,
  "nope-10": s_nope_10,
  "nope-11": s_nope_11,
  "nope-12": s_nope_12,
  "staplebops-01": s_staplebops_01,
  "staplebops-02": s_staplebops_02,
  "staplebops-03": s_staplebops_03,
  "staplebops-04": s_staplebops_04,
  "staplebops-05": s_staplebops_05,
  "staplebops-06": s_staplebops_06,
  "staplebops-07": s_staplebops_07,
  "yup-01": s_yup_01,
  "yup-02": s_yup_02,
  "yup-03": s_yup_03,
  "yup-04": s_yup_04,
  "yup-05": s_yup_05,
  "yup-06": s_yup_06,
}

/** All selectable custom sound ids, in catalog order (grouped by family). */
export const CUSTOM_SOUND_IDS: readonly string[] = Object.keys(CUSTOM_SOUND_FILES)

/** e.g. "bip-bop-03" -> "Bip-Bop 03". Matches the VS Code and JetBrains sound picker labels. */
export function attentionCustomSoundLabel(id: string): string {
  const parts = id.split("-")
  const num = parts.pop()
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-")
  return num ? `${name} ${num}` : name
}

/** e.g. "bip-bop-03" -> "Bip-Bop". Used to group the picker's option list by sound family. */
export function attentionCustomSoundCategory(id: string): string {
  const parts = id.split("-")
  parts.pop()
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-")
}

/** KV key backing the /sound command's selection - see `soundVolume`/`soundCandidates` below. */
export const ATTENTION_CUSTOM_SOUND_KV_KEY = "attention_custom_sound"
// mycelis_change end

type FocusState = "unknown" | "focused" | "blurred"

type AttentionRenderer = {
  readonly isDestroyed: boolean
  on(event: "focus" | "blur", listener: () => void): unknown
  off(event: "focus" | "blur", listener: () => void): unknown
  triggerNotification(message: string, title?: string): boolean
}

type RegisteredSoundPack = TuiAttentionSoundPack & {
  builtin: boolean
}

type TuiAttentionHost = TuiAttention & {
  dispose(): void
}

const DEFAULT_TITLE = "Mycelis" // mycelis_change
const DEFAULT_PACK_ID = "kilo.default" // kilocode_change
const KV_SOUND_PACK = "attention_sound_pack"
const TITLE_LIMIT = 80
const MESSAGE_LIMIT = 240
const BUILTIN_PACK: RegisteredSoundPack = {
  id: DEFAULT_PACK_ID,
  name: "Mycelis Default", // mycelis_change
  builtin: true,
  sounds: {
    default: CUSTOM_SOUND_FILES["bip-bop-01"], // mycelis_change - shared with CUSTOM_SOUND_FILES, see above
    question: CUSTOM_SOUND_FILES["bip-bop-03"],
    permission: CUSTOM_SOUND_FILES["staplebops-06"],
    error: CUSTOM_SOUND_FILES["nope-03"],
    done: CUSTOM_SOUND_FILES["bip-bop-01"],
    subagent_done: CUSTOM_SOUND_FILES["yup-01"],
  },
}

function skipped(reason: TuiAttentionNotifySkipReason): TuiAttentionNotifyResult {
  return {
    ok: false,
    notification: false,
    sound: false,
    skipped: reason,
  }
}

function normalizeText(input: string | undefined, fallback: string, limit: number) {
  const text = stripAnsi(input ?? "")
    .replace(/[ \t]*[\r\n]+[ \t]*/g, " ")
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .trim()
  const normalized = text.length ? text : fallback
  return Array.from(normalized).slice(0, limit).join("")
}

function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return 0
  return Math.min(1, Math.max(0, volume))
}

function soundVolume(
  input: TuiAttentionNotifyInput,
  config: Pick<TuiConfig.Resolved, "attention">,
  kv?: TuiKV, // mycelis_change
) {
  // mycelis_change - "Off" picked via /sound mutes every attention sound, regardless of config.
  if (kv?.get<string>(ATTENTION_CUSTOM_SOUND_KV_KEY) === "off") return
  if (!config.attention.sound) return
  if (input.sound === false) return
  if (input.sound === undefined) return clampVolume(config.attention.volume)
  if (input.sound === true) return clampVolume(config.attention.volume)
  return clampVolume(input.sound.volume ?? config.attention.volume)
}

function normalizePack(pack: TuiAttentionSoundPack): RegisteredSoundPack | undefined {
  const id = pack.id.trim()
  if (!id) return
  return {
    id,
    name: pack.name?.trim() || undefined,
    builtin: false,
    sounds: Object.fromEntries(
      Object.entries(pack.sounds).filter(
        (item): item is [TuiAttentionSoundName, string] =>
          Schema.is(AttentionSoundName)(item[0]) && typeof item[1] === "string" && item[1].trim().length > 0,
      ),
    ),
  }
}

function focusSkip(when: TuiAttentionWhen, focus: FocusState) {
  if (when === "always") return
  if (focus === "unknown") return "focus_unknown"
  if (when === "blurred" && focus === "focused") return "focused"
  if (when === "focused" && focus === "blurred") return "blurred"
}

export function createTuiAttention(input: {
  renderer: AttentionRenderer
  config: Pick<TuiConfig.Resolved, "attention">
  kv?: TuiKV
  audio?: Pick<typeof TuiAudio, "loadSoundFile" | "play">
}): TuiAttentionHost {
  let focus: FocusState = "unknown"
  let disposed = false
  let activePackID: string | undefined
  const packs = new Map<string, RegisteredSoundPack>([[BUILTIN_PACK.id, BUILTIN_PACK]])
  const audio = input.audio ?? TuiAudio

  const onFocus = () => {
    focus = "focused"
  }
  const onBlur = () => {
    focus = "blurred"
  }

  input.renderer.on("focus", onFocus)
  input.renderer.on("blur", onBlur)

  function configuredPackID() {
    const stored = input.kv?.get<string | undefined>(KV_SOUND_PACK, undefined)
    return activePackID ?? stored ?? input.config.attention.sound_pack
  }

  function currentPack() {
    return packs.get(configuredPackID()) ?? BUILTIN_PACK
  }

  function soundCandidates(name: TuiAttentionSoundName) {
    // mycelis_change start - a sound chosen via /sound overrides every event uniformly (same
    // behavior as the VS Code and JetBrains notification-sound pickers), ahead of per-event
    // config/pack sounds. "off" is handled earlier in soundVolume; "default"/unset falls through.
    const custom = input.kv?.get<string | undefined>(ATTENTION_CUSTOM_SOUND_KV_KEY, undefined)
    const override = custom && custom !== "off" && custom !== "default" ? CUSTOM_SOUND_FILES[custom] : undefined
    return [override, input.config.attention.sounds[name], currentPack().sounds[name], BUILTIN_PACK.sounds[name]].filter(
      (item, index, list): item is string => typeof item === "string" && list.indexOf(item) === index,
    )
    // mycelis_change end
  }

  async function playSound(name: TuiAttentionSoundName, volume: number) {
    try {
      for (const file of soundCandidates(name)) {
        const current = await audio.loadSoundFile(file).catch((error) => {
          console.debug("failed to load attention sound", { file, error })
          return null
        })
        if (disposed) return false
        if (current == null) continue
        if (audio.play(current, { volume }) != null) return true
      }
      return false
    } catch (error) {
      console.debug("failed to play attention sound", { error })
      return false
    }
  }

  return {
    async notify(request) {
      try {
        if (!input.config.attention.enabled) return skipped("attention_disabled")
        if (disposed || input.renderer.isDestroyed) return skipped("renderer_destroyed")

        const message = normalizeText(request.message, "", MESSAGE_LIMIT)
        if (!message) return skipped("empty_message")

        const requestedNotification = typeof request.notification === "object" ? request.notification : undefined
        const notificationSkip = focusSkip(requestedNotification?.when ?? "blurred", focus)
        const notificationRequested = input.config.attention.notifications && request.notification !== false
        const shouldNotify = notificationRequested && !notificationSkip
        const notification = shouldNotify
          ? (() => {
              try {
                return input.renderer.triggerNotification(
                  message,
                  normalizeText(request.title, DEFAULT_TITLE, TITLE_LIMIT),
                )
              } catch (error) {
                console.debug("failed to trigger attention notification", { error })
                return false
              }
            })()
          : false
        const volume = soundVolume(request, input.config, input.kv) // mycelis_change - respect /sound "Off"
        const requestedSound = typeof request.sound === "object" ? request.sound : undefined
        const soundSkip = volume === undefined ? undefined : focusSkip(requestedSound?.when ?? "always", focus)
        const soundName =
          requestedSound?.name && Schema.is(AttentionSoundName)(requestedSound.name) ? requestedSound.name : "default"
        const sound = volume === undefined || soundSkip ? false : await playSound(soundName, volume)

        if (!notification && !sound) {
          if (notificationRequested && notificationSkip) return skipped(notificationSkip)
          if (soundSkip) return skipped(soundSkip)
        }

        return {
          ok: notification || sound,
          notification,
          sound,
        }
      } catch (error) {
        console.debug("failed to handle attention notification", { error })
        return {
          ok: false,
          notification: false,
          sound: false,
        }
      }
    },
    soundboard: {
      registerPack(pack) {
        const next = normalizePack(pack)
        if (!next) return () => {}
        packs.set(next.id, next)
        let disposed = false
        return () => {
          if (disposed) return
          disposed = true
          if (packs.get(next.id) === next) packs.delete(next.id)
        }
      },
      activate(id, options) {
        const pack = packs.get(id)
        if (!pack) return false
        activePackID = pack.id
        if (options?.persist) input.kv?.set(KV_SOUND_PACK, pack.id)
        return true
      },
      current() {
        return currentPack().id
      },
      list(): TuiAttentionSoundPackInfo[] {
        const current = currentPack().id
        return Array.from(packs.values()).map((pack) => ({
          id: pack.id,
          name: pack.name,
          active: pack.id === current,
          builtin: pack.builtin,
        }))
      },
    },
    dispose() {
      if (disposed) return
      disposed = true
      input.renderer.off("focus", onFocus)
      input.renderer.off("blur", onBlur)
    },
  }
}

// mycelis_change start - standalone preview for the /sound command (DialogNotificationSound).
// Deliberately independent of a live TuiAttentionHost instance: previewing must work the moment
// the dialog opens, without needing the current session's renderer/config/kv wiring.
export async function previewAttentionSound(
  id: string,
  options?: { volume?: number; audio?: Pick<typeof TuiAudio, "loadSoundFile" | "play"> },
): Promise<boolean> {
  if (id === "off") return false
  const file = id === "default" ? BUILTIN_PACK.sounds.default : CUSTOM_SOUND_FILES[id]
  if (!file) return false
  const audio = options?.audio ?? TuiAudio
  const volume = clampVolume(options?.volume ?? 0.4)
  const sound = await audio.loadSoundFile(file).catch(() => null)
  if (!sound) return false
  return audio.play(sound, { volume }) != null
}
// mycelis_change end
