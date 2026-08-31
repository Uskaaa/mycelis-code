import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { KiloProvider, KiloProviderOptions } from "./types.js"
import { getApiKey } from "./auth/token.js"
import { buildKiloHeaders, getDefaultHeaders } from "./headers.js"
import { ANONYMOUS_API_KEY, MYCELIS_GATEWAY_BASE } from "./api/constants.js" // mycelis_change
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
  // OpenRouter-compatible endpoint; resolveKiloOpenRouterBaseUrl kept below (unused) for the
  // embedding/image model paths, which still go through the `openrouter` SDK instance further down.
  const openRouterUrl = resolveKiloOpenRouterBaseUrl({ baseURL: options.baseURL, token: apiKey })
  const gatewayUrl = options.baseURL ?? MYCELIS_GATEWAY_BASE
  // mycelis_change end

  // Merge custom headers with defaults
  const customHeaders = {
    ...getDefaultHeaders(),
    ...buildKiloHeaders(undefined, {
      kilocodeOrganizationId: options.kilocodeOrganizationId,
      kilocodeTesterWarningsDisabledUntil: undefined,
    }),
    ...options.headers,
  }

  // Create custom fetch wrapper to add dynamic headers
  const originalFetch = options.fetch ?? fetch
  const wrappedFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = buildRequestHeaders(customHeaders, init?.headers)
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
    headers: customHeaders,
    fetch: wrappedFetch as typeof fetch,
  }

  // mycelis_change - chat requests go to Mycelis's OpenAI-compatible gateway; embedding/image
  // models below still use `sdkOptions` (Kilo's OpenRouter endpoint), untouched for now.
  const gatewaySdkOptions = { ...sdkOptions, baseURL: gatewayUrl }

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
