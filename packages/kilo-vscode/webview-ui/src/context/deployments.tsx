// mycelis_change - new file, mirrors context/provider.tsx's load/retry shape
import { createContext, useContext, createSignal, createEffect, onCleanup } from "solid-js"
import type { ParentComponent, Accessor } from "solid-js"
import { useVSCode } from "./vscode"
import type { Deployment, ExtensionMessage, MarketplaceModel, DeploymentGpuEstimate } from "../types/messages"
import { createDeploymentAction } from "../utils/deployment-action"
import { isDeploymentSettled } from "../utils/deployment-status"

const POLL_INTERVAL_MS = 5000

interface DeploymentsContextValue {
  deployments: Accessor<Deployment[]>
  loading: Accessor<boolean>
  create: (input: {
    name: string
    modelId: string
    maxConcurrentUsers: number
    autoStopOnInactivity: boolean
    inactivityTimeoutMinutes?: number
    isExposedToWebUi: boolean
  }) => Promise<Deployment>
  start: (id: string) => Promise<Deployment>
  stop: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  marketplaceModels: (search?: string) => Promise<MarketplaceModel[]>
  gpuEstimate: (modelId: string, concurrentUsers?: number) => Promise<DeploymentGpuEstimate | null>
}

const DeploymentsContext = createContext<DeploymentsContextValue>()

export const DeploymentsProvider: ParentComponent = (props) => {
  const vscode = useVSCode()
  const action = createDeploymentAction(vscode)

  const [deployments, setDeployments] = createSignal<Deployment[]>([])
  const [loading, setLoading] = createSignal(true)

  // Register immediately (not in onMount) so we never miss a deploymentsLoaded
  // message that arrives before the DOM mount — same reasoning as ProviderProvider.
  const unsubscribe = vscode.onMessage((message: ExtensionMessage) => {
    if (message.type !== "deploymentsLoaded") return
    setDeployments(message.deployments)
    setLoading(false)
  })
  onCleanup(unsubscribe)

  vscode.postMessage({ type: "requestDeployments" })

  const fallback = setTimeout(() => {
    if (loading()) vscode.postMessage({ type: "requestDeployments" })
  }, 3000)

  const unsubReady = vscode.onMessage((message: ExtensionMessage) => {
    if (message.type !== "extensionDataReady") return
    unsubReady()
    clearTimeout(fallback)
    if (loading()) vscode.postMessage({ type: "requestDeployments" })
  })

  // mycelis_change start - a deployment can take minutes to provision or stop, with no push/SSE
  // status update - poll while anything is still transitioning, and stop once everything settles.
  let pollTimer: ReturnType<typeof setInterval> | undefined
  createEffect(() => {
    const pending = deployments().some((d) => !isDeploymentSettled(d.status))
    if (pending && !pollTimer) {
      pollTimer = setInterval(() => vscode.postMessage({ type: "requestDeployments" }), POLL_INTERVAL_MS)
    }
    if (!pending && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  })
  // mycelis_change end

  onCleanup(() => {
    unsubReady()
    clearTimeout(fallback)
    if (pollTimer) clearInterval(pollTimer)
    action.dispose()
  })

  function create(input: {
    name: string
    modelId: string
    maxConcurrentUsers: number
    autoStopOnInactivity: boolean
    inactivityTimeoutMinutes?: number
    isExposedToWebUi: boolean
  }): Promise<Deployment> {
    return new Promise((resolve, reject) => {
      action.send(
        { type: "createDeployment", ...input },
        {
          onCreated: (m) => resolve(m.deployment),
          onError: (m) => reject(new Error(m.message)),
        },
      )
    })
  }

  function start(id: string): Promise<Deployment> {
    return new Promise((resolve, reject) => {
      action.send(
        { type: "startDeployment", id },
        {
          onStarted: (m) => resolve(m.deployment),
          onError: (m) => reject(new Error(m.message)),
        },
      )
    })
  }

  function stop(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      action.send(
        { type: "stopDeployment", id },
        {
          onStopped: () => resolve(),
          onError: (m) => reject(new Error(m.message)),
        },
      )
    })
  }

  function remove(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      action.send(
        { type: "deleteDeployment", id },
        {
          onDeleted: () => resolve(),
          onError: (m) => reject(new Error(m.message)),
        },
      )
    })
  }

  function marketplaceModels(search?: string): Promise<MarketplaceModel[]> {
    return new Promise((resolve, reject) => {
      action.send(
        { type: "requestMarketplaceModels", search },
        {
          onMarketplaceModels: (m) => (m.error ? reject(new Error(m.error)) : resolve(m.models)),
        },
      )
    })
  }

  function gpuEstimate(modelId: string, concurrentUsers?: number): Promise<DeploymentGpuEstimate | null> {
    return new Promise((resolve) => {
      action.send(
        { type: "requestGpuEstimate", modelId, concurrentUsers },
        // mycelis_change - mirrors the CLI wizard's `.catch(() => undefined)`: a failed
        // estimate never blocks the create flow, so resolve null instead of rejecting.
        { onGpuEstimate: (m) => resolve(m.estimate) },
      )
    })
  }

  const value: DeploymentsContextValue = {
    deployments,
    loading,
    create,
    start,
    stop,
    remove,
    marketplaceModels,
    gpuEstimate,
  }

  return <DeploymentsContext.Provider value={value}>{props.children}</DeploymentsContext.Provider>
}

export function useDeployments(): DeploymentsContextValue {
  const ctx = useContext(DeploymentsContext)
  if (!ctx) throw new Error("useDeployments must be used within DeploymentsProvider")
  return ctx
}
