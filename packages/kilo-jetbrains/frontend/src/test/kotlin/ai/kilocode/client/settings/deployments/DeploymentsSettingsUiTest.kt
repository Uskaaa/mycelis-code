// mycelis_change - new file
package ai.kilocode.client.settings.deployments

import ai.kilocode.client.app.KiloAppService
import ai.kilocode.client.app.KiloDeploymentService
import ai.kilocode.client.testing.FakeAppRpcApi
import ai.kilocode.client.testing.FakeDeploymentRpcApi
import ai.kilocode.client.testing.fire
import ai.kilocode.client.ui.list.ActiveListItem
import ai.kilocode.client.ui.list.activeListCellBounds
import ai.kilocode.client.util.edtWait
import ai.kilocode.rpc.dto.ConfigDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.KiloAppStateDto
import ai.kilocode.rpc.dto.KiloAppStatusDto
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.TestDialog
import com.intellij.openapi.ui.TestDialogManager
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.testFramework.replaceService
import com.intellij.ui.components.JBList
import java.awt.Container
import java.awt.Dimension
import java.awt.Point
import java.awt.event.InputEvent
import java.awt.event.MouseEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

class DeploymentsSettingsUiTest : BasePlatformTestCase() {
    private var scope: CoroutineScope? = null
    private var ui: DeploymentsSettingsUi? = null
    private lateinit var rpc: FakeDeploymentRpcApi

    override fun tearDown() {
        try {
            TestDialogManager.setTestDialog(TestDialog.DEFAULT)
            ui?.let { panel -> edt { panel.dispose(); true } }
            ui = null
            scope?.cancel()
            scope = null
        } finally {
            super.tearDown()
        }
    }

    fun `test loads deployments with status and cost`() {
        val panel = panel(
            DeploymentDto(
                id = "dep_1", name = "Marketing Bot", slug = "marketing-bot", modelId = "m1", modelName = "Llama 3",
                status = "Running", maxConcurrentUsers = 5.0, costPerHour = 0.5,
            ),
        )
        flushUntil { rows(panel).size == 1 }

        edt {
            val row = rows(panel).single()
            assertEquals("Marketing Bot", row.title)
            assertEquals("Llama 3 · $0.50/hr", row.description)
            assertEquals(listOf("Running"), row.badges.map { it.text })
            assertEquals(listOf("stop", "delete"), row.cells.map { it.id })
            true
        }
    }

    fun `test stop cell stops a running deployment`() {
        val panel = panel(
            DeploymentDto(
                id = "dep_1", name = "Bot", slug = "bot", modelId = "m1", modelName = "Llama 3",
                status = "Running", maxConcurrentUsers = 5.0, costPerHour = 0.5,
            ),
        )
        flushUntil { rows(panel).size == 1 }

        click(panel, "dep_1", "stop")

        flushUntil { rpc.stops.isNotEmpty() }
        assertEquals(listOf(DeploymentActionDto(DIR, "dep_1")), rpc.stops)
    }

    fun `test delete cell requires confirmation then deletes`() {
        val panel = panel(
            DeploymentDto(
                id = "dep_1", name = "Bot", slug = "bot", modelId = "m1", modelName = "Llama 3",
                status = "Stopped", maxConcurrentUsers = 5.0, costPerHour = 0.5,
            ),
        )
        flushUntil { rows(panel).size == 1 }
        rpc.state = DeploymentsStateDto()
        TestDialogManager.setTestDialog(TestDialog.YES)

        click(panel, "dep_1", "delete")

        flushUntil { rows(panel).isEmpty() }
        assertEquals(listOf(DeploymentActionDto(DIR, "dep_1")), rpc.deletes)
    }

    private fun panel(vararg initial: DeploymentDto): DeploymentsSettingsUi {
        val cs = CoroutineScope(SupervisorJob())
        scope = cs
        rpc = FakeDeploymentRpcApi().apply { state = DeploymentsStateDto(deployments = initial.toList()) }
        val appRpc = FakeAppRpcApi()
        val app = KiloAppService(cs, appRpc)
        val ready = KiloAppStateDto(KiloAppStatusDto.READY, config = ConfigDto())
        app._state.value = ready
        appRpc.state.value = ready
        ApplicationManager.getApplication().replaceService(KiloAppService::class.java, app, testRootDisposable)
        ApplicationManager.getApplication().replaceService(KiloDeploymentService::class.java, KiloDeploymentService(cs, rpc), testRootDisposable)
        val panel = edt { DeploymentsSettingsUi(cs, DIR) }
        ui = panel
        edt { panel.reload(); true }
        return panel
    }

    private fun click(panel: DeploymentsSettingsUi, key: String, id: String) {
        edt {
            val list = list(panel)
            list.size = Dimension(460, 260)
            list.doLayout()
            val idx = rows(panel).indexOfFirst { it.key == key }
            list.selectedIndex = idx
            val area = activeListCellBounds(list, idx, selected = true).getValue(id)
            val point = Point(area.x + area.width / 2, area.y + area.height / 2)
            fire(list, mouse(list, MouseEvent.MOUSE_PRESSED, point))
            fire(list, mouse(list, MouseEvent.MOUSE_RELEASED, point))
            true
        }
    }

    private fun mouse(list: JBList<ActiveListItem>, id: Int, point: Point) = MouseEvent(
        list, id, System.currentTimeMillis(),
        if (id == MouseEvent.MOUSE_PRESSED) InputEvent.BUTTON1_DOWN_MASK else 0,
        point.x, point.y, 1, false, MouseEvent.BUTTON1,
    )

    private fun rows(panel: DeploymentsSettingsUi): List<ActiveListItem> {
        val model = list(panel).model
        return (0 until model.size).map { model.getElementAt(it) }
    }

    private fun list(panel: DeploymentsSettingsUi) = components(panel).filterIsInstance<JBList<ActiveListItem>>().single()

    private fun components(root: java.awt.Component): List<java.awt.Component> {
        val out = mutableListOf<java.awt.Component>()
        fun visit(item: java.awt.Component) {
            out += item
            if (item is Container) item.components.forEach { visit(it) }
        }
        visit(root)
        return out
    }

    private fun <T> edt(block: () -> T): T = edtWait(block)

    private fun flushUntil(done: () -> Boolean) = runBlocking {
        repeat(300) {
            delay(10)
            edt { com.intellij.util.ui.UIUtil.dispatchAllInvocationEvents(); true }
            if (done()) return@runBlocking
        }
        edt { com.intellij.util.ui.UIUtil.dispatchAllInvocationEvents(); true }
        assertTrue(done())
    }

    private companion object {
        const val DIR = "/test"
    }
}
