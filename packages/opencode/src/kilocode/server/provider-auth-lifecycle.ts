import { ModelCache } from "@/provider/model-cache"
import { Provider } from "@/provider/provider" // mycelis_change
import { InstanceStore } from "@/project/instance-store" // mycelis_change
import { InstanceRef } from "@/effect/instance-ref" // mycelis_change
import { KiloViewers } from "@/kilocode/presence/service" // kilocode_change
import { Effect } from "effect"

// kilocode_change start - drop the old presence socket; callers invoke this for the "kilo" provider only
export const invalidatePresence = Effect.fn("KiloServer.invalidatePresence")(function* () {
  const viewers = yield* KiloViewers.Service
  yield* viewers.invalidateAuth()
})
// kilocode_change end

// mycelis_change - fast path: only refreshes the cached provider/model list instead of tearing
// down the whole instance (LSP clients, plugins, indexing, etc.) via InstanceStore.disposeAll -
// that full teardown was the actual source of the multi-second delay users saw after signing in
// or out. Provider.Service is instance-scoped (needs an InstanceRef bound to the current
// request/effect), so this is only directly usable from call sites already running within one -
// e.g. the OAuth callback route and the Anaconda Desktop sync route, both under InstanceHttpApi
// with WorkspaceRoutingQuery.
export const invalidateAfterProviderAuthChange = Effect.fn("KiloServer.invalidateAfterProviderAuthChange")(function* (
  providerID: string,
) {
  const cache = yield* ModelCache.Service
  yield* cache.clear(providerID)
  const provider = yield* Provider.Service
  yield* provider.invalidate()
})

// mycelis_change - control-plane path: auth.set/auth.remove (control.ts) have no
// WorkspaceRoutingQuery and so run with no InstanceRef bound of their own, so
// invalidateAfterProviderAuthChange above can't be used directly. Provider.Service itself isn't
// tied to one instance though - it's a single running service whose internal cache is keyed by
// directory via InstanceState/ScopedCache - so instead of disposing every loaded instance
// (InstanceStore.disposeAll, which also tears down LSP clients, plugins, etc.), enumerate the
// instances that are actually loaded (InstanceStore.loaded()) and invalidate just the provider
// cache for each one by explicitly binding its InstanceRef for that one call.
export const invalidateAllLoadedInstanceProviders = Effect.fn(
  "KiloServer.invalidateAllLoadedInstanceProviders",
)(function* (providerID: string) {
  const cache = yield* ModelCache.Service
  yield* cache.clear(providerID)
  const provider = yield* Provider.Service
  const store = yield* InstanceStore.Service
  const instances = yield* store.loaded()
  yield* Effect.forEach(instances, (ctx) => provider.invalidate().pipe(Effect.provideService(InstanceRef, ctx)), {
    concurrency: 4,
  })
})
