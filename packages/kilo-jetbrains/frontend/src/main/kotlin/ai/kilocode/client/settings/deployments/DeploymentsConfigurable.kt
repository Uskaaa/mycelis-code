// mycelis_change - new file
package ai.kilocode.client.settings.deployments

import ai.kilocode.client.app.KiloDeploymentService
import ai.kilocode.client.plugin.KiloBundle
import ai.kilocode.client.settings.base.DirectoryReadyConfigurable
import ai.kilocode.client.settings.base.SettingsListPanel
import ai.kilocode.client.settings.base.SettingsMessageException
import ai.kilocode.client.settings.base.SettingsToolbarAction
import ai.kilocode.client.ui.UiStyle
import ai.kilocode.client.ui.list.ActiveListBadge
import ai.kilocode.client.ui.list.ActiveListCell
import ai.kilocode.client.ui.list.ActiveListConfig
import ai.kilocode.client.ui.list.ActiveListItem
import ai.kilocode.client.ui.list.ActiveListSelection
import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentDto
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.application.EDT
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.asContextElement
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import javax.swing.JComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val edt = Dispatchers.EDT + ModalityState.any().asContextElement()

class DeploymentsConfigurable : DirectoryReadyConfigurable<JComponent>() {
    override fun getId(): String = ID
    override fun getDisplayName(): String = KiloBundle.message("settings.deployments.displayName")
    override fun create(cs: CoroutineScope, dir: String): JComponent = DeploymentsSettingsUi(cs, dir)
    override fun update(ui: JComponent, dir: String) {
        (ui as? DeploymentsSettingsUi)?.setDirectory(dir)
    }
    override fun scrollReadyShell() = false

    companion object { const val ID = "ai.kilocode.jetbrains.settings.deployments" }
}

// mycelis_change - explicit Locale.US symbols; a bare DecimalFormat pattern otherwise uses the
// JVM's default locale's decimal separator (e.g. "," ), which reads oddly paired with a literal "$".
private val COST_FMT = DecimalFormat("$#,##0.00", DecimalFormatSymbols(Locale.US))

internal class DeploymentsSettingsUi(
    private val cs: CoroutineScope,
    dir: String,
) : SettingsListPanel(cs, ActiveListConfig.Equal) {
    private var dir = dir
    private var deployments: Map<String, DeploymentDto> = emptyMap()

    init {
        start()
    }

    fun setDirectory(value: String) {
        if (value == dir) return
        dir = value
        reload()
    }

    override suspend fun fetch(): List<ActiveListItem> {
        val state = service<KiloDeploymentService>().list(dir)
        if (state.errors.isNotEmpty()) {
            LOG.warn("deployments fetch errors dir=$dir errors=${state.errors.size}")
        }
        withContext(edt) { deployments = state.deployments.associateBy { it.id } }
        return state.deployments.map(::item)
    }

    override fun onCell(key: String, cellId: String) {
        when (cellId) {
            START_CELL -> toggle(key, start = true)
            STOP_CELL -> toggle(key, start = false)
            DELETE_CELL -> remove(key)
        }
    }

    override fun searchPlaceholder() = KiloBundle.message("settings.deployments.search")

    override fun emptyText() = KiloBundle.message("settings.deployments.empty")

    override fun loadingText() = KiloBundle.message("settings.deployments.loading")

    override fun extraActions(): List<AnAction> = listOf(
        SettingsToolbarAction(
            KiloBundle.message("settings.deployments.new"),
            KiloBundle.message("settings.deployments.new.description"),
            AllIcons.General.Add,
            { !busy },
        ) { create() },
    )

    // mycelis_change - DialogWrapper.createCenterPanel() runs synchronously on EDT, so the model
    // catalog must be fetched before the dialog is constructed rather than inside it.
    private fun create() {
        if (!launch("deployment-create-load") { id ->
            val models = service<KiloDeploymentService>().marketplaceModels(dir)
            withContext(edt) {
                if (!active(id)) return@withContext
                setBusy(false)
                clearProgress()
                if (models.isEmpty()) {
                    showError(KiloBundle.message("settings.deployments.create.noModels"))
                    return@withContext
                }
                if (DeploymentCreateDialog(cs, dir, models).showAndGet()) reload()
            }
        }) return
        showProgress(KiloBundle.message("settings.deployments.create.loadingModels"))
    }

    private fun toggle(id: String, start: Boolean) {
        mutateAndReload(ActiveListSelection.Key(id)) {
            val service = service<KiloDeploymentService>()
            val result = if (start) service.start(DeploymentActionDto(dir, id)) else service.stop(DeploymentActionDto(dir, id))
            val error = result.error
            if (error != null) throw SettingsMessageException(error)
            true
        }
    }

    private fun remove(id: String) {
        val name = deployments[id]?.name ?: id
        val result = Messages.showYesNoDialog(
            KiloBundle.message("settings.deployments.delete.message", name),
            KiloBundle.message("settings.deployments.delete.title"),
            KiloBundle.message("common.delete"),
            Messages.getCancelButton(),
            Messages.getWarningIcon(),
        )
        if (result != Messages.YES) return
        mutateAndReload(ActiveListSelection.Slide) {
            val res = service<KiloDeploymentService>().delete(DeploymentActionDto(dir, id))
            val error = res.error
            if (error != null) throw SettingsMessageException(error)
            true
        }
    }

    private fun item(deployment: DeploymentDto): ActiveListItem {
        val running = deployment.status.equals("running", ignoreCase = true)
        return object : ActiveListItem {
            override val key = deployment.id
            override val title = deployment.name
            override val description = "${deployment.modelName} · ${COST_FMT.format(deployment.costPerHour)}/hr"
            override val badges = listOf(ActiveListBadge(deployment.status, statusStyle(deployment.status)))
            override val cells = listOf(
                ActiveListCell(
                    if (running) STOP_CELL else START_CELL,
                    if (running) KiloBundle.message("settings.deployments.detail.stop") else KiloBundle.message("settings.deployments.detail.start"),
                ),
                ActiveListCell(
                    DELETE_CELL,
                    KiloBundle.message("common.delete"),
                    icon = AllIcons.Actions.GC,
                    iconOnly = true,
                ),
            )
        }
    }

    private fun statusStyle(status: String): UiStyle.Badge.Style = when (status.lowercase()) {
        "running" -> UiStyle.Badge.Highlight
        "error" -> UiStyle.Badge.Alert
        else -> UiStyle.Badge.Secondary
    }

    private companion object {
        const val START_CELL = "start"
        const val STOP_CELL = "stop"
        const val DELETE_CELL = "delete"
        val LOG = KiloLog.create(DeploymentsSettingsUi::class.java)
    }
}
