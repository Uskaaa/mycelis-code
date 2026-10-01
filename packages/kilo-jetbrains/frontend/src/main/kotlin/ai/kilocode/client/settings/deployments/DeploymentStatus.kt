// mycelis_change - new file
package ai.kilocode.client.settings.deployments

/**
 * Mirrors isDeploymentSettled() in the CLI (deployment-status.ts) and VS Code extension
 * (deployment-status.ts) - `status` is a free-form string passed straight through from Mycelis's
 * own deployment API, so there is no fixed enum on this side. Anything other than these known
 * terminal states (e.g. "Pending", "Provisioning", "Starting", "Stopping") is treated as still
 * transitioning and worth polling for.
 */
private val SETTLED = setOf("running", "stopped", "error", "failed")

internal fun isDeploymentSettled(status: String): Boolean = status.lowercase() in SETTLED
