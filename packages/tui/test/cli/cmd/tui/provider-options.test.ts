import { describe, expect, test } from "bun:test"
import { normalizeCustomProviderID, providerOptions } from "../../../../src/component/dialog-provider"

describe("providerOptions", () => {
  // mycelis_change - while Mycelis is the only supported sign-in path, isProviderHidden filters
  // every non-"kilo" provider out unless it's explicitly configured by the user (source
  // "config") - these fixtures represent providers the user set up in their own kilo.jsonc, so
  // they carry that source to stay visible and keep testing real provider-list behavior instead
  // of just the synthetic "Other" fallback.
  test("includes a synthetic Other option for custom providers", () => {
    expect(providerOptions([{ id: "openai", name: "OpenAI", source: "config" }]).at(-1)).toMatchObject({
      title: "Other",
      description: "Custom provider",
      category: "Providers",
    })
  })

  test("does not use Other as the generic provider category", () => {
    expect(providerOptions([{ id: "mistral", name: "Mistral", source: "config" }])[0]?.category).toBe("Providers")
  })

  test("keeps popular providers first and sorts the rest alphabetically", () => {
    expect(
      providerOptions([
        { id: "openai", name: "OpenAI", source: "config" },
        { id: "custom-z", name: "Zebra Provider", source: "config" },
        { id: "anthropic", name: "Anthropic", source: "config" },
        { id: "mistral", name: "Mistral", source: "config" },
        { id: "aws", name: "AWS Bedrock", source: "config" },
      ]).map((option) => option.value),
    ).toEqual(["anthropic", "openai", "aws", "mistral", "custom-z", "__opencode_custom_provider__"]) // kilocode_change - preserve Kilo provider priority
  })

  test("does not collide with a configured provider named other", () => {
    const values = providerOptions([{ id: "other", name: "Other Provider", source: "config" }]).map(
      (option) => option.value,
    )
    expect(new Set(values).size).toBe(values.length)
  })

  test("hides an auto-discovered provider that the user never configured", () => {
    expect(providerOptions([{ id: "openai", name: "OpenAI" }]).map((option) => option.value)).toEqual([
      "__opencode_custom_provider__",
    ])
  })

  test("normalizes and validates custom provider ids", () => {
    expect(normalizeCustomProviderID("  custom-provider  ")).toBe("custom-provider")
    expect(normalizeCustomProviderID("custom_provider")).toBe("custom_provider")
    expect(normalizeCustomProviderID("@ai-sdk/custom-provider")).toBe("custom-provider")
    expect(normalizeCustomProviderID("-custom-provider")).toBeUndefined()
    expect(normalizeCustomProviderID("Custom Provider")).toBeUndefined()
  })
})
