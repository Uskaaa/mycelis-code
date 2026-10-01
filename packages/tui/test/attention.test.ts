// mycelis_change - new file
import { describe, expect, test } from "bun:test"
import type { TuiKV } from "@kilocode/plugin/tui"
import {
  ATTENTION_CUSTOM_SOUND_KV_KEY,
  CUSTOM_SOUND_IDS,
  attentionCustomSoundCategory,
  attentionCustomSoundLabel,
  createTuiAttention,
  previewAttentionSound,
} from "../src/attention"

function fakeRenderer() {
  return {
    isDestroyed: false,
    on() {},
    off() {},
    triggerNotification() {
      return true
    },
  }
}

function fakeConfig() {
  return {
    attention: {
      enabled: true,
      notifications: true,
      sound: true,
      volume: 0.4,
      sound_pack: "kilo.default",
      sounds: {},
    },
  }
}

function fakeKV(initial: Record<string, unknown> = {}): TuiKV {
  const store: Record<string, unknown> = { ...initial }
  return {
    get: (<Value = unknown>(key: string, fallback?: Value) =>
      (key in store ? store[key] : fallback) as Value) as TuiKV["get"],
    set: (key: string, value: unknown) => {
      store[key] = value
    },
    ready: true,
  }
}

function fakeAudio() {
  const loaded: string[] = []
  const played: unknown[] = []
  return {
    loaded,
    played,
    async loadSoundFile(file: string) {
      loaded.push(file)
      return { file } as any
    },
    play(sound: unknown, options?: unknown) {
      played.push({ sound, options })
      return {} as any
    },
  }
}

describe("attentionCustomSoundLabel / attentionCustomSoundCategory", () => {
  test("formats the bundled sound catalog consistently with the VS Code/JetBrains pickers", () => {
    expect(attentionCustomSoundLabel("bip-bop-03")).toBe("Bip-Bop 03")
    expect(attentionCustomSoundCategory("bip-bop-03")).toBe("Bip-Bop")
    expect(attentionCustomSoundLabel("alert-01")).toBe("Alert 01")
    expect(attentionCustomSoundLabel("staplebops-06")).toBe("Staplebops 06")
  })

  test("lists all 45 bundled sounds with distinct ids and labels", () => {
    expect(CUSTOM_SOUND_IDS.length).toBe(45)
    expect(new Set(CUSTOM_SOUND_IDS).size).toBe(45)
    expect(new Set(CUSTOM_SOUND_IDS.map(attentionCustomSoundLabel)).size).toBe(45)
  })
})

describe("createTuiAttention custom sound override", () => {
  test("without an override, different events play their own default sound", async () => {
    const audio = fakeAudio()
    const attention = createTuiAttention({ renderer: fakeRenderer(), config: fakeConfig(), kv: fakeKV(), audio })

    await attention.notify({ message: "q", notification: false, sound: { name: "question", when: "always" } })
    await attention.notify({ message: "e", notification: false, sound: { name: "error", when: "always" } })

    expect(audio.loaded.length).toBe(2)
    expect(audio.loaded[0]).not.toBe(audio.loaded[1])
  })

  test("a sound chosen via /sound overrides every event with the same file", async () => {
    const audio = fakeAudio()
    const kv = fakeKV({ [ATTENTION_CUSTOM_SOUND_KV_KEY]: "yup-01" })
    const attention = createTuiAttention({ renderer: fakeRenderer(), config: fakeConfig(), kv, audio })

    const question = await attention.notify({
      message: "q",
      notification: false,
      sound: { name: "question", when: "always" },
    })
    const error = await attention.notify({ message: "e", notification: false, sound: { name: "error", when: "always" } })

    expect(question.sound).toBe(true)
    expect(error.sound).toBe(true)
    expect(audio.loaded.length).toBe(2)
    expect(audio.loaded[0]).toBe(audio.loaded[1])
  })

  test("'off' mutes every attention sound regardless of the sound config", async () => {
    const audio = fakeAudio()
    const kv = fakeKV({ [ATTENTION_CUSTOM_SOUND_KV_KEY]: "off" })
    const attention = createTuiAttention({ renderer: fakeRenderer(), config: fakeConfig(), kv, audio })

    const result = await attention.notify({
      message: "q",
      notification: false,
      sound: { name: "question", when: "always" },
    })

    expect(result.sound).toBe(false)
    expect(audio.loaded.length).toBe(0)
  })
})

describe("previewAttentionSound", () => {
  test("plays the chosen sound independent of any attention host", async () => {
    const audio = fakeAudio()

    const ok = await previewAttentionSound("bip-bop-01", { audio })

    expect(ok).toBe(true)
    expect(audio.played.length).toBe(1)
  })

  test("does nothing for 'off'", async () => {
    const audio = fakeAudio()

    const ok = await previewAttentionSound("off", { audio })

    expect(ok).toBe(false)
    expect(audio.loaded.length).toBe(0)
  })
})
