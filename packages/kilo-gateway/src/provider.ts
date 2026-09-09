import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { KiloProvider, KiloProviderOptions } from "./types.js"
import { getApiKey } from "./auth/token.js"
import { buildKiloHeaders, getDefaultHeaders } from "./headers.js"
import {
  ANONYMOUS_API_KEY,
  MYCELIS_GATEWAY_BASE,
  HEADER_MYCELIS_ORGANIZATIONID,
  HEADER_ORGANIZATIONID,
} from "./api/constants.js" // mycelis_change
import { resolveKiloOpenRouterBaseUrl } from "./api/url.js"
import { transformRequestBody } from "./responses.js"
import * as GatewayMetadata from "./gateway-metadata.js"

export function buildRequestHeaders(defaultHeaders: Record<string, string>, requestHeaders?: HeadersInit): Headers {
  const headers = new Headers(defaultHeaders)
  new Headers(requestHeaders).forEach((value, key) => {
    headers.set(key, value)
  })
  return headers
}

/**
 * Create a KiloCode provider instance
 *
 * This provider wraps the OpenRouter SDK with KiloCode-specific configuration
 * including custom authentication, headers, and base URL.
 *
 * @example
 * ```typescript
 * const provider = createKilo({
 *   kilocodeToken: "your-token-here",
 *   kilocodeOrganizationId: "org-123"
 * })
 *
 * const model = provider.languageModel("anthropic/claude-sonnet-4")
 * ```
 */
export function createKilo(options: KiloProviderOptions = {}): KiloProvider {
  // Get API key from options or environment
  const apiKey = getApiKey(options)

  // mycelis_change start - point requests at the Mycelis model gateway instead of Kilo's
  // OpenRouter-compatible endpoint; resolveKiloOpenRouterBaseUrl kept below for the
  // embedding/image model paths, which still go through the `openrouter` SDK instance further
  // down and intentionally stay on Kilo's real endpoint (not yet migrated to Mycelis).
  //
  // openRouterUrl deliberately does NOT read options.baseURL: the auth-plugin loader
  // (kiloCustomLoaders.kilo in opencode) pins options.baseURL to MYCELIS_GATEWAY_BASE so that
  // Provider.resolveSDK's own fallback (model.api.url, the real Kilo endpoint from the
  // ModelsDev catalog) can't silently override gatewayUrl below - reusing that same
  // Mycelis-pinned value here would incorrectly redirect embeddings/images at Mycelis too.
  const openRouterUrl = resolveKiloOpenRouterBaseUrl({ token: apiKey })
  const gatewayUrl = options.baseURL ?? MYCELIS_GATEWAY_BASE
  // mycelis_change end

  // Merge custom headers with defaults - built WITHOUT an org header, since which one applies
  // depends on which backend the actual request is going to (see wrappedFetch below).
  const baseHeaders = {
    ...getDefaultHeaders(),
    ...buildKiloHeaders(undefined, { kilocodeTesterWarningsDisabledUntil: undefined }),
    ...options.headers,
  }

  // mycelis_change - Kilo's real API (still used here for embeddings/images via openRouterUrl)
  // and Mycelis's own gateway (chat, via gatewayUrl) each expect their own org/workspace header
  // name - kilo-gateway.ts's clawStatus and the indexing embedder still send the Kilo one to
  // kilocode.ai, so it can't just be renamed everywhere; Mycelis's proxy controllers
  // (YarpGatewayController etc.) only ever understand HEADER_MYCELIS_ORGANIZATIONID.
  const kiloHeaders = {
    ...baseHeaders,
    ...(options.kilocodeOrganizationId ? { [HEADER_ORGANIZATIONID]: options.kilocodeOrganizationId } : {}),
  }
  const mycelisHeaders = {
    ...baseHeaders,
    ...(options.kilocodeOrganizationId ? { [HEADER_MYCELIS_ORGANIZATIONID]: options.kilocodeOrganizationId } : {}),
  }

  // Create custom fetch wrapper to add dynamic headers
  const originalFetch = options.fetch ?? fetch
  const wrappedFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const defaults = url.startsWith(gatewayUrl) ? mycelisHeaders : kiloHeaders // mycelis_change
    const headers = buildRequestHeaders(defaults, init?.headers)
    const body = transformRequestBody(input, init?.body, options.dataCollection)

    // Add authorization if API key exists
    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`)
    }

    return originalFetch(input, {
      ...init,
      headers,
      body,
    })
  }

  const sdkOptions = {
    baseURL: openRouterUrl,
    apiKey: apiKey ?? ANONYMOUS_API_KEY,
    headers: kiloHeaders, // mycelis_change
    fetch: wrappedFetch as typeof fetch,
  }

  // mycelis_change - chat requests go to Mycelis's OpenAI-compatible gateway; embedding/image
  // models below still use `sdkOptions` (Kilo's OpenRouter endpoint), untouched for now.
  const gatewaySdkOptions = { ...sdkOptions, baseURL: gatewayUrl, headers: mycelisHeaders } // mycelis_change

  const openrouter = createOpenRouter(sdkOptions)
  const anthropic = createAnthropic(gatewaySdkOptions) // mycelis_change
  const openai = createOpenAI(gatewaySdkOptions) // mycelis_change
  const openaiCompatible = createOpenAICompatible({ ...gatewaySdkOptions, name: "openaiCompatible" }) // mycelis_change

  return {
    languageModel(modelId) {
      return openaiCompatible(modelId) // mycelis_change
    },
    embeddingModel(modelId: string) {
      return openrouter.textEmbeddingModel(modelId)
    },
    rerankingModel(modelId: string): never {
      throw new Error(`Reranking model not supported: ${modelId}`)
    },
    imageModel(modelId) {
      return openrouter.imageModel(modelId)
    },
    anthropic(modelId) {
      return GatewayMetadata.wrap(anthropic(modelId))
    },
    openai(modelId) {
      return GatewayMetadata.wrap(openai(modelId))
    },
    openaiCompatible(modelId) {
      return openaiCompatible(modelId)
    },
  }
}
