import { expect } from "bun:test"
import { Effect, Layer, Ref } from "effect"
import {
  invalidateAfterProviderAuthChange,
  invalidateAllLoadedInstanceProviders,
} from "../../../src/kilocode/server/provider-auth-lifecycle"
import { Provider } from "../../../src/provider/provider"
import { InstanceStore } from "../../../src/project/instance-store"
import { ModelCache } from "../../../src/provider/model-cache"
import { testEffect } from "../../lib/effect"
import type { InstanceContext } from "../../../src/project/instance-context"

const it = testEffect(Layer.empty)

function cacheLayer(events: Ref.Ref<string[]>) {
  return Layer.mock(ModelCache.Service)({
    clear: (providerID) => Ref.update(events, (items) => [...items, `clear:${providerID}`]),
  })
}

it.effect(
  // mycelis_change - the instance-scoped fast path (OAuth callback, Anaconda Desktop sync):
  // refreshes just the provider/model cache instead of disposing the whole instance
  "invalidateAfterProviderAuthChange clears provider models then invalidates the provider cache",
  () =>
    Effect.gen(function* () {
      const events = yield* Ref.make<string[]>([])
      const layer = Layer.mergeAll(
        cacheLayer(events),
        Layer.mock(Provider.Service)({
          invalidate: () => Ref.update(events, (items) => [...items, "invalidate"]),
        }),
      )

      yield* invalidateAfterProviderAuthChange("kilo").pipe(Effect.provide(layer))

      expect(yield* Ref.get(events)).toEqual(["clear:kilo", "invalidate"])
    }),
)

it.effect(
  // mycelis_change - the control-plane path (auth.set/auth.remove, no InstanceRef bound of its
  // own): invalidates the provider cache for every already-loaded instance individually instead
  // of disposing them, since Provider.Service can be used from anywhere as long as an
  // InstanceRef is bound for that one call.
  "invalidateAllLoadedInstanceProviders clears provider models then invalidates each loaded instance",
  () =>
    Effect.gen(function* () {
      const events = yield* Ref.make<string[]>([])
      const contexts = [{ directory: "/a" }, { directory: "/b" }] as unknown as InstanceContext[]
      const layer = Layer.mergeAll(
        cacheLayer(events),
        Layer.mock(Provider.Service)({
          invalidate: () => Ref.update(events, (items) => [...items, "invalidate"]),
        }),
        Layer.mock(InstanceStore.Service)({
          loaded: () => Effect.succeed(contexts),
        }),
      )

      yield* invalidateAllLoadedInstanceProviders("kilo").pipe(Effect.provide(layer))

      expect(yield* Ref.get(events)).toEqual(["clear:kilo", "invalidate", "invalidate"])
    }),
)
