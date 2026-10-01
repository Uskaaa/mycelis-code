// mycelis_change - new file
/**
 * Mycelis deployment status helper, shared by context/deployments.tsx and the Settings UI.
 *
 * `status` is a free-form string passed straight through from Mycelis's own deployment API (see
 * kilo-vscode/src/kilo-provider/handlers/deployments.ts) - there is no fixed enum on this side.
 * Anything other than these known terminal states (e.g. "Pending", "Provisioning", "Starting",
 * "Stopping") is treated as still transitioning and worth polling for.
 */
const SETTLED = new Set(["running", "stopped", "error", "failed"])

export function isDeploymentSettled(status: string): boolean {
  return SETTLED.has(status.toLowerCase())
}
