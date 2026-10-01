// mycelis_change - new file
package ai.kilocode.client.settings.deployments

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DeploymentStatusTest {
    @Test
    fun `terminal statuses are settled, case-insensitively`() {
        for (status in listOf("Running", "running", "Stopped", "STOPPED", "Error", "Failed")) {
            assertTrue(isDeploymentSettled(status), status)
        }
    }

    @Test
    fun `transitional statuses are not settled`() {
        for (status in listOf("Pending", "Provisioning", "Starting", "Stopping", "Deploying", "Deleting")) {
            assertFalse(isDeploymentSettled(status), status)
        }
    }
}
