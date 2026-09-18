import type { Provider, ProviderModel, ModelSelection } from "../types/messages"

// mycelis_change - carries the parent provider's `source` so callers can tell a provider the
// user explicitly configured (source "config") apart from an auto-discovered one, without
// re-looking the provider up by id.
export type EnrichedModel = ProviderModel & { providerID: string; providerName: string; providerSource?: string }

/**
 * Flatten a provider map into a list of models enriched with provider info.
 */
export function flattenModels(providers: Record<string, Provider>): EnrichedModel[] {
  const result: EnrichedModel[] = []
  for (const providerID of Object.keys(providers)) {
    const provider = providers[providerID]!
    for (const modelID of Object.keys(provider.models)) {
      result.push({
        ...provider.models[modelID]!,
        id: modelID,
        providerID,
        providerName: provider.name,
        providerSource: provider.source, // mycelis_change
      })
    }
  }
  return result
}

/**
 * Find an enriched model from a flat model list by provider ID and model ID.
 */
export function findModel(models: EnrichedModel[], selection: ModelSelection | null): EnrichedModel | undefined {
  if (!selection) return undefined
  return models.find((m) => m.providerID === selection.providerID && m.id === selection.modelID)
}

/**
 * True when the selection points to an existing model in a connected provider.
 * Kilo gateway models remain usable whenever the provider catalog exposes them.
 */
export function isModelValid(
  providers: Record<string, Provider>,
  connected: string[],
  selection: ModelSelection | null,
): boolean {
  if (!selection) return false
  const provider = providers[selection.providerID]
  if (!provider) return false
  if (selection.providerID !== "kilo" && !connected.includes(selection.providerID)) return false
  return !!provider.models[selection.modelID]
}
