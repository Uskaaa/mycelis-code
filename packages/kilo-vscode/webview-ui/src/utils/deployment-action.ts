// mycelis_change - new file, mirrors provider-action.ts's request-correlator shape
import type {
  CreateDeploymentMessage,
  DeleteDeploymentMessage,
  DeploymentActionErrorMessage,
  DeploymentCreatedMessage,
  DeploymentDeletedMessage,
  DeploymentStartedMessage,
  DeploymentStoppedMessage,
  ExtensionMessage,
  GpuEstimateLoadedMessage,
  MarketplaceModelsLoadedMessage,
  RequestGpuEstimateMessage,
  RequestMarketplaceModelsMessage,
  StartDeploymentMessage,
  StopDeploymentMessage,
  WebviewMessage,
} from "../types/messages"

type DeploymentRequest =
  | CreateDeploymentMessage
  | StartDeploymentMessage
  | StopDeploymentMessage
  | DeleteDeploymentMessage
  | RequestMarketplaceModelsMessage
  | RequestGpuEstimateMessage

type DeploymentRequestInput =
  | Omit<CreateDeploymentMessage, "requestId">
  | Omit<StartDeploymentMessage, "requestId">
  | Omit<StopDeploymentMessage, "requestId">
  | Omit<DeleteDeploymentMessage, "requestId">
  | Omit<RequestMarketplaceModelsMessage, "requestId">
  | Omit<RequestGpuEstimateMessage, "requestId">

type Transport = {
  postMessage: (message: WebviewMessage) => void
  onMessage: (handler: (message: ExtensionMessage) => void) => () => void
}

type Handlers = {
  onCreated?: (message: DeploymentCreatedMessage) => void
  onStarted?: (message: DeploymentStartedMessage) => void
  onStopped?: (message: DeploymentStoppedMessage) => void
  onDeleted?: (message: DeploymentDeletedMessage) => void
  onMarketplaceModels?: (message: MarketplaceModelsLoadedMessage) => void
  onGpuEstimate?: (message: GpuEstimateLoadedMessage) => void
  onError?: (message: DeploymentActionErrorMessage) => void
}

export function createDeploymentAction(vscode: Transport) {
  const pending = new Map<string, Handlers>()
  const unsubscribe = vscode.onMessage((message) => {
    if (!("requestId" in message)) return

    const item = pending.get(message.requestId)
    if (!item) return
    pending.delete(message.requestId)

    if (message.type === "deploymentCreated") return item.onCreated?.(message)
    if (message.type === "deploymentStarted") return item.onStarted?.(message)
    if (message.type === "deploymentStopped") return item.onStopped?.(message)
    if (message.type === "deploymentDeleted") return item.onDeleted?.(message)
    if (message.type === "marketplaceModelsLoaded") return item.onMarketplaceModels?.(message)
    if (message.type === "gpuEstimateLoaded") return item.onGpuEstimate?.(message)
    if (message.type === "deploymentActionError") item.onError?.(message)
  })

  function send(message: DeploymentRequestInput, handlers: Handlers = {}) {
    const requestId = crypto.randomUUID()
    pending.set(requestId, handlers)
    vscode.postMessage({ ...message, requestId } as DeploymentRequest)
    return requestId
  }

  function clear(requestId?: string) {
    if (requestId) {
      pending.delete(requestId)
      return
    }
    pending.clear()
  }

  function dispose() {
    clear()
    unsubscribe()
  }

  return { clear, send, dispose }
}
