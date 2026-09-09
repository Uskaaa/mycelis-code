// mycelis_change - new file
import { MYCELIS_WEB_URL, HEADER_MYCELIS_ORGANIZATIONID, MODELS_FETCH_TIMEOUT_MS } from "./constants.js"

export interface Deployment {
  id: string
  name: string
  slug: string
  modelId: string
  modelName: string
  status: string
  accessUrl?: string
  maxConcurrentUsers: number
  costPerHour: number
  workspaceId?: string
}

export interface MarketplaceModel {
  id: string
  name: string
  provider: string
  description: string
  vramRequiredGb: number
}

export interface GpuEstimate {
  modelId: string
  gpuTypeId?: string
  gpuName?: string
  costPerHourUsd?: number
  memoryInGb?: number
}

function headers(pat: string, organizationId?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
    ...(organizationId ? { [HEADER_MYCELIS_ORGANIZATIONID]: organizationId } : {}),
  }
}

async function parseJsonError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? `Request failed: ${response.status}`
  } catch {
    return `Request failed: ${response.status}`
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    // mycelis_change - without a timeout, a stalled connection (proxy/firewall dropping packets
    // silently instead of refusing the connection, or a genuinely slow backend) left the CLI's
    // /deployments dialog stuck on "Loading..." forever with nothing to show or catch.
    response = await fetch(`${MYCELIS_WEB_URL}${path}`, { ...init, signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS) })
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError"
    throw new Error(
      timedOut
        ? `Timed out reaching Mycelis backend at ${MYCELIS_WEB_URL} after ${MODELS_FETCH_TIMEOUT_MS / 1000}s`
        : `Could not reach Mycelis backend at ${MYCELIS_WEB_URL} - is it running?`,
      { cause },
    )
  }
  if (!response.ok) throw new Error(await parseJsonError(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const BASE = "/api/proxy/v1/deployments"

export function fetchDeployments(pat: string, organizationId?: string): Promise<Deployment[]> {
  return request(BASE, { headers: headers(pat, organizationId) })
}

export function createDeployment(
  pat: string,
  input: { name: string; modelId: string; maxConcurrentUsers?: number },
  organizationId?: string,
): Promise<Deployment> {
  return request(BASE, {
    method: "POST",
    headers: headers(pat, organizationId),
    body: JSON.stringify({ name: input.name, modelId: input.modelId, maxConcurrentUsers: input.maxConcurrentUsers ?? 5 }),
  })
}

export function startDeployment(pat: string, id: string, organizationId?: string): Promise<Deployment> {
  return request(`${BASE}/${encodeURIComponent(id)}/start`, { method: "POST", headers: headers(pat, organizationId) })
}

export function stopDeployment(pat: string, id: string, organizationId?: string): Promise<void> {
  return request(`${BASE}/${encodeURIComponent(id)}/stop`, { method: "POST", headers: headers(pat, organizationId) })
}

export function deleteDeployment(pat: string, id: string, organizationId?: string): Promise<void> {
  return request(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(pat, organizationId) })
}

export function fetchMarketplaceModels(
  pat: string,
  search?: string,
  organizationId?: string,
): Promise<MarketplaceModel[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ""
  return request(`${BASE}/marketplace-models${query}`, { headers: headers(pat, organizationId) })
}

export function fetchGpuEstimate(
  pat: string,
  modelId: string,
  concurrentUsers = 1,
  organizationId?: string,
): Promise<GpuEstimate> {
  const query = `?modelId=${encodeURIComponent(modelId)}&concurrentUsers=${concurrentUsers}`
  return request(`${BASE}/gpu-estimate${query}`, { headers: headers(pat, organizationId) })
}
