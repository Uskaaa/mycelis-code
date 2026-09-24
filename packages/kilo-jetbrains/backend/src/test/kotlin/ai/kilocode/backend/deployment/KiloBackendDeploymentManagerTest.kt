// mycelis_change - new file
package ai.kilocode.backend.deployment

import ai.kilocode.backend.app.KiloAppState
import ai.kilocode.backend.app.KiloBackendAppService
import ai.kilocode.backend.testing.FakeCliServer
import ai.kilocode.backend.testing.MockCliServer
import ai.kilocode.backend.testing.TestLog
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KiloBackendDeploymentManagerTest {

    private val mock = MockCliServer()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @AfterTest
    fun tearDown() {
        scope.cancel()
        mock.close()
    }

    @Test
    fun `list returns deployments parsed from the CLI response`() = runBlocking {
        mock.deployments = """[{
            "id":"dep_1","name":"Marketing Bot","slug":"marketing-bot","modelId":"m1","modelName":"Llama 3",
            "status":"Running","maxConcurrentUsers":5,"costPerHour":0.42
        }]"""
        val manager = manager()

        val state = manager.list("/test")

        assertEquals(1, state.deployments.size)
        assertEquals("Marketing Bot", state.deployments.first().name)
        assertEquals("Running", state.deployments.first().status)
        assertTrue(state.errors.isEmpty())
    }

    @Test
    fun `list surfaces a load error instead of throwing on malformed responses`() = runBlocking {
        mock.deployments = "not json"
        val manager = manager()

        val state = manager.list("/test")

        assertTrue(state.deployments.isEmpty())
        assertEquals(1, state.errors.size)
    }

    @Test
    fun `create sends all six wizard fields and returns refreshed state`() = runBlocking {
        mock.deployments = "[]"
        mock.deploymentCreateResult = """{
            "id":"dep_1","name":"Marketing Bot","slug":"marketing-bot","modelId":"m1","modelName":"Llama 3",
            "status":"Stopped","maxConcurrentUsers":5,"costPerHour":0.42
        }"""
        val manager = manager()

        val result = manager.create(
            CreateDeploymentDto(
                directory = "/test",
                name = "Marketing Bot",
                modelId = "m1",
                maxConcurrentUsers = 5.0,
                autoStopOnInactivity = true,
                inactivityTimeoutMinutes = 30.0,
                isExposedToWebUi = true,
            ),
        )

        assertNull(result.error)
        val body = mock.lastCreateDeploymentBody.orEmpty()
        assertContains(body, "\"name\":\"Marketing Bot\"")
        assertContains(body, "\"modelId\":\"m1\"")
        assertContains(body, "\"maxConcurrentUsers\":5.0")
        assertContains(body, "\"autoStopOnInactivity\":true")
        assertContains(body, "\"inactivityTimeoutMinutes\":30.0")
        assertContains(body, "\"isExposedToWebUi\":true")
    }

    @Test
    fun `start reports the server error and still returns refreshed state`() = runBlocking {
        mock.deployments = "[]"
        mock.deploymentActionStatus = 404
        val manager = manager()

        val result = manager.start(DeploymentActionDto("/test", "dep_missing"))

        assertEquals(true, result.error?.contains("404"))
        assertTrue(result.state.deployments.isEmpty())
        mock.deploymentActionStatus = 200
    }

    @Test
    fun `stop and delete hit the expected id-scoped path`() = runBlocking {
        mock.deployments = "[]"
        val manager = manager()

        manager.stop(DeploymentActionDto("/test", "dep_1"))
        assertEquals("/kilo/deployments/dep_1/stop", mock.lastDeploymentActionPath)

        manager.delete(DeploymentActionDto("/test", "dep_1"))
        assertEquals("/kilo/deployments/dep_1", mock.lastDeploymentActionPath)
    }

    @Test
    fun `marketplaceModels and gpuEstimate decode the CLI responses`() = runBlocking {
        mock.marketplaceModels = """[{"id":"m1","name":"Llama 3","provider":"meta","description":"Open model","vramRequiredGb":16}]"""
        mock.gpuEstimate = """{"modelId":"m1","gpuName":"A100","costPerHourUsd":0.75}"""
        val manager = manager()

        val models = manager.marketplaceModels("/test", null)
        val estimate = manager.gpuEstimate("/test", "m1", 5)

        assertEquals(1, models.size)
        assertEquals("Llama 3", models.first().name)
        assertEquals("A100", estimate.gpuName)
        assertEquals(0.75, estimate.costPerHourUsd)
    }

    private suspend fun manager(): KiloBackendDeploymentManager = KiloBackendDeploymentManager(app())

    private suspend fun app(): KiloBackendAppService {
        val app = KiloBackendAppService.create(scope, FakeCliServer(mock), TestLog())
        app.connect()
        withTimeout(10_000) {
            app.appState.first { it is KiloAppState.Ready }
        }
        return app
    }
}
