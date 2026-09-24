// mycelis_change - new file
/**
 * Deployment management handlers — mirrors kilo-provider/handlers/auth.ts's shape.
 *
 * Wraps client.kilo.deployments.* (list/create/start/stop/delete/marketplaceModels/gpuEstimate).
 * No vscode dependency.
 */

import type { KiloClient } from "@kilocode/sdk/v2/client"
import { getErrorMessage } from "../../kilo-provider-utils"
import type {
  KilocodeDeployment,
  KilocodeMarketplaceModel,
  KilocodeDeploymentGpuEstimate,
} from "../../services/cli-backend/types" // mycelis_change

export interface DeploymentsContext {
  readonly client: KiloClient | null
  postMessage(msg: unknown): void
  getWorkspaceDirectory(): string
}

type Action = "create" | "start" | "stop" | "delete"

function postError(ctx: DeploymentsContext, requestId: string, action: Action, err: unknown) {
  ctx.postMessage({ type: "deploymentActionError", requestId, action, message: getErrorMessage(err) })
}

/** Fetch the deployment list and push it to the webview. */
export async function fetchAndSendDeployments(ctx: DeploymentsContext): Promise<void> {
  if (!ctx.client) return
  try {
    const { data } = await ctx.client.kilo.deployments.list(
      { directory: ctx.getWorkspaceDirectory() },
      { throwOnError: true },
    )
    const deployments: KilocodeDeployment[] = data ?? []
    ctx.postMessage({ type: "deploymentsLoaded", deployments })
  } catch (err) {
    console.error("[Kilo New] fetchAndSendDeployments failed:", err)
  }
}

export interface CreateDeploymentInput {
  name: string
  modelId: string
  maxConcurrentUsers: number
  autoStopOnInactivity: boolean
  inactivityTimeoutMinutes?: number
  isExposedToWebUi: boolean
}

export async function createDeployment(
  ctx: DeploymentsContext,
  requestId: string,
  input: CreateDeploymentInput,
): Promise<void> {
  if (!ctx.client) return
  try {
    const { data } = await ctx.client.kilo.deployments.create(
      { directory: ctx.getWorkspaceDirectory(), ...input },
      { throwOnError: true },
    )
    const deployment: KilocodeDeployment | undefined = data
    if (!deployment) throw new Error("Create deployment returned no data")
    ctx.postMessage({ type: "deploymentCreated", requestId, deployment })
    await fetchAndSendDeployments(ctx)
  } catch (err) {
    postError(ctx, requestId, "create", err)
  }
}

export async function startDeployment(ctx: DeploymentsContext, requestId: string, id: string): Promise<void> {
  if (!ctx.client) return
  try {
    const { data } = await ctx.client.kilo.deployments.start(
      { id, directory: ctx.getWorkspaceDirectory() },
      { throwOnError: true },
    )
    ctx.postMessage({ type: "deploymentStarted", requestId, deployment: data })
    await fetchAndSendDeployments(ctx)
  } catch (err) {
    postError(ctx, requestId, "start", err)
  }
}

export async function stopDeployment(ctx: DeploymentsContext, requestId: string, id: string): Promise<void> {
  if (!ctx.client) return
  try {
    await ctx.client.kilo.deployments.stop({ id, directory: ctx.getWorkspaceDirectory() }, { throwOnError: true })
    ctx.postMessage({ type: "deploymentStopped", requestId })
    await fetchAndSendDeployments(ctx)
  } catch (err) {
    postError(ctx, requestId, "stop", err)
  }
}

export async function deleteDeployment(ctx: DeploymentsContext, requestId: string, id: string): Promise<void> {
  if (!ctx.client) return
  try {
    await ctx.client.kilo.deployments.delete({ id, directory: ctx.getWorkspaceDirectory() }, { throwOnError: true })
    ctx.postMessage({ type: "deploymentDeleted", requestId })
    await fetchAndSendDeployments(ctx)
  } catch (err) {
    postError(ctx, requestId, "delete", err)
  }
}

export async function fetchMarketplaceModels(
  ctx: DeploymentsContext,
  requestId: string,
  search?: string,
): Promise<void> {
  if (!ctx.client) return
  try {
    const { data } = await ctx.client.kilo.deployments.marketplaceModels(
      { directory: ctx.getWorkspaceDirectory(), search },
      { throwOnError: true },
    )
    const models: KilocodeMarketplaceModel[] = data ?? []
    ctx.postMessage({ type: "marketplaceModelsLoaded", requestId, models })
  } catch (err) {
    ctx.postMessage({ type: "marketplaceModelsLoaded", requestId, models: [], error: getErrorMessage(err) })
  }
}

export async function fetchGpuEstimate(
  ctx: DeploymentsContext,
  requestId: string,
  modelId: string,
  concurrentUsers?: number,
): Promise<void> {
  if (!ctx.client) return
  try {
    const { data } = await ctx.client.kilo.deployments.gpuEstimate(
      {
        directory: ctx.getWorkspaceDirectory(),
        modelId,
        concurrentUsers: concurrentUsers != null ? String(concurrentUsers) : undefined,
      },
      { throwOnError: true },
    )
    const estimate: KilocodeDeploymentGpuEstimate | null = data ?? null
    ctx.postMessage({ type: "gpuEstimateLoaded", requestId, estimate })
  } catch (err) {
    // mycelis_change - the CLI wizard swallows gpuEstimate failures too (see
    // dialog-deployment-create.tsx's `.catch(() => undefined)`) so a missing
    // estimate never blocks deploying; surface it as "no estimate" rather than an error.
    ctx.postMessage({ type: "gpuEstimateLoaded", requestId, estimate: null, error: getErrorMessage(err) })
  }
}
