// kilocode_change - new file
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { ModelCache } from "./model-cache"
import * as Core from "@opencode-ai/core/models-dev"
import { Context, Effect, Layer } from "effect"
import { AI_SDK_PROVIDERS, KILO_OPENROUTER_BASE, PROMPTS } from "@kilocode/kilo-gateway"
import { overlay } from "@/kilocode/anaconda-desktop/provider"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder" // kilocode_change

export const Model = Core.Model
export type Model = Core.Model
export const Provider = Core.Provider
export type Provider = Core.Provider
export const CatalogModelStatus = Core.CatalogModelStatus
export type CatalogModelStatus = Core.CatalogModelStatus

export interface Interface extends Core.Interface {}

export class Service extends Context.Service<Service, Interface>()("@opencode/ModelsDev") {}

function baseURL(url: string | undefined, org: string | undefined) {
  if (!url) return
  const base = url.replace(/\/+$/, "")
  if (org) {
    if (base.includes("/api/organizations/")) return base
    if (base.endsWith("/api")) return `${base}/organizations/${org}`
    return `${base}/api/organizations/${org}`
  }
  if (base.includes("/openrouter")) return base
  if (base.endsWith("/api")) return `${base}/openrouter`
  return `${base}/api/openrouter`
}

export const layer: Layer.Layer<Service, never, Core.Service | Config.Service | Auth.Service | ModelCache.Service> =
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const core = yield* Core.Service
      const config = yield* Config.Service
      const auth = yield* Auth.Service
      const cache = yield* ModelCache.Service

      const get = Effect.fn("ModelsDev.get")(function* () {
        const providers = overlay(yield* core.get())
        // mycelis_change - the static models.dev "kilo" entry (~366 generic OpenRouter-style
        // models) is discarded outright now, not kept as a fallback - see the comment below.
        delete providers.kilo

        const cfg = yield* config.get()
        const disabled = new Set(cfg.disabled_providers ?? [])
        const enabled = cfg.enabled_providers ? new Set(cfg.enabled_providers) : undefined
        const allowed = (!enabled || enabled.has("kilo")) && !disabled.has("kilo")
        const apt = cfg.provider?.apertis?.options
        const aptURL = apt?.baseURL ?? "https://api.apertis.ai/v1"
        const aptOpts = apt?.baseURL ? { baseURL: apt.baseURL } : {}

        const addApertis = Effect.fnUntraced(function* () {
          if (providers.apertis) return
          const models = yield* cache.fetch("apertis", aptOpts).pipe(Effect.catch(() => Effect.succeed({})))
          providers.apertis = {
            id: "apertis",
            name: "Apertis",
            env: ["APERTIS_API_KEY"],
            api: aptURL,
            npm: "@ai-sdk/openai-compatible",
            models,
          }
          if (Object.keys(models).length === 0)
            yield* cache.refresh("apertis", aptOpts).pipe(Effect.ignore, Effect.forkDetach)
        })

        if (!allowed) {
          yield* addApertis()
          return providers
        }

        const opts = cfg.provider?.kilo?.options
        const info = yield* auth.get("kilo").pipe(Effect.catch(() => Effect.succeed(undefined)))
        // mycelis_change - PAT ("api") auth has no accountId (that's oauth-only); the selected
        // workspace rides along on its metadata bag instead (see model-cache.ts's authOptions,
        // which already resolves this correctly and wins here since org ends up undefined and
        // this object omits the key entirely rather than setting it - kept for consistency/
        // defense in depth, not because it's currently reachable through a different path).
        const org =
          opts?.kilocodeOrganizationId ??
          (info?.type === "oauth" ? info.accountId : info?.type === "api" ? info.metadata?.organizationId : undefined)
        const url = baseURL(opts?.baseURL, org)
        const fetch = {
          ...(url ? { baseURL: url } : {}),
          ...(org ? { kilocodeOrganizationId: org } : {}),
        }
        const fetched = yield* cache.fetch("kilo", fetch).pipe(Effect.catch(() => Effect.succeed({})))
        // mycelis_change - was: fall back to the static models.dev catalog for "kilo" (366
        // generic OpenRouter-style models) whenever Mycelis returns zero models. That fallback
        // made sense for real Kilo Code (network hiccup => show the known catalog anyway) but is
        // actively wrong for Mycelis: a workspace with no deployments legitimately has zero
        // models, and none of that static catalog's model IDs work against Mycelis's own gateway
        // anyway - showing them just looked like "all these other providers are back" once
        // grouped under the Mycelis category. An empty list is the correct, honest result.
        const models = fetched
        providers.kilo = {
          id: "kilo",
          name: "Kilo Gateway",
          env: ["KILO_API_KEY"],
          api: KILO_OPENROUTER_BASE.endsWith("/") ? KILO_OPENROUTER_BASE : `${KILO_OPENROUTER_BASE}/`,
          npm: "@kilocode/kilo-gateway",
          models,
        }
        if (Object.keys(fetched).length === 0) yield* cache.refresh("kilo", fetch).pipe(Effect.ignore, Effect.forkDetach)
        yield* addApertis()
        return providers
      })

      return Service.of({ get, refresh: core.refresh })
    }),
  )

export const defaultLayer: Layer.Layer<Service> = Layer.suspend(() => AppNodeBuilder.build(node)) // kilocode_change - build from the LayerNode graph

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [Core.node, Config.node, Auth.node, ModelCache.node],
})

export { AI_SDK_PROVIDERS, PROMPTS }
export * as ModelsDev from "./models"
