// mycelis_change - new file
// Deployment management — mirrors packages/opencode/src/kilocode/server/httpapi/groups/kilo-gateway.ts

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

export interface DeploymentGpuEstimate {
  modelId: string
  gpuTypeId?: string
  gpuName?: string
  costPerHourUsd?: number
  memoryInGb?: number
}

export type DeploymentAction = "create" | "start" | "stop" | "delete"

// ---- webview -> extension ----

export interface RequestDeploymentsMessage {
  type: "requestDeployments"
}

export interface CreateDeploymentMessage {
  type: "createDeployment"
  requestId: string
  name: string
  modelId: string
  maxConcurrentUsers: number
  autoStopOnInactivity: boolean
  inactivityTimeoutMinutes?: number
  isExposedToWebUi: boolean
}

export interface StartDeploymentMessage {
  type: "startDeployment"
  requestId: string
  id: string
}

export interface StopDeploymentMessage {
  type: "stopDeployment"
  requestId: string
  id: string
}

export interface DeleteDeploymentMessage {
  type: "deleteDeployment"
  requestId: string
  id: string
}

export interface RequestMarketplaceModelsMessage {
  type: "requestMarketplaceModels"
  requestId: string
  search?: string
}

export interface RequestGpuEstimateMessage {
  type: "requestGpuEstimate"
  requestId: string
  modelId: string
  concurrentUsers?: number
}

// ---- extension -> webview ----

export interface DeploymentsLoadedMessage {
  type: "deploymentsLoaded"
  deployments: Deployment[]
}

export interface DeploymentCreatedMessage {
  type: "deploymentCreated"
  requestId: string
  deployment: Deployment
}

export interface DeploymentStartedMessage {
  type: "deploymentStarted"
  requestId: string
  deployment: Deployment
}

export interface DeploymentStoppedMessage {
  type: "deploymentStopped"
  requestId: string
}

export interface DeploymentDeletedMessage {
  type: "deploymentDeleted"
  requestId: string
}

export interface DeploymentActionErrorMessage {
  type: "deploymentActionError"
  requestId: string
  action: DeploymentAction
  message: string
}

export interface MarketplaceModelsLoadedMessage {
  type: "marketplaceModelsLoaded"
  requestId: string
  models: MarketplaceModel[]
  error?: string
}

export interface GpuEstimateLoadedMessage {
  type: "gpuEstimateLoaded"
  requestId: string
  estimate: DeploymentGpuEstimate | null
  error?: string
}
