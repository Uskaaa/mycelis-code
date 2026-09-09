// kilocode_change - new file
// mycelis_change - rewritten: "connected" means signed in to Mycelis specifically. The "kilo"
// provider always autoloads anonymously (Kilo's free tier), so it's unconditionally present in
// provider_next - the only thing that distinguishes real Mycelis sign-in is its `source`, which
// is "api" (the Mycelis PAT credential) rather than "custom" (the anonymous free-tier fallback).
import { describe, expect, test } from "bun:test"
import { isKiloConnected } from "../src/component/use-connected"

describe("isKiloConnected", () => {
  test("not connected when kilo is missing or only anonymously autoloaded", () => {
    expect(isKiloConnected([])).toBe(false)
    expect(isKiloConnected([{ id: "anthropic", source: "api" }])).toBe(false)
    expect(isKiloConnected([{ id: "kilo", source: "custom" }])).toBe(false)
  })

  test("connected once kilo has a real credential-backed source", () => {
    expect(isKiloConnected([{ id: "kilo", source: "api" }])).toBe(true)
    expect(isKiloConnected([{ id: "anthropic", source: "api" }, { id: "kilo", source: "oauth" }])).toBe(true)
  })
})
