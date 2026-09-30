// mycelis_change - new file
package ai.kilocode.client.settings.deployments

import ai.kilocode.client.app.KiloDeploymentService
import ai.kilocode.client.plugin.KiloBundle
import ai.kilocode.client.settings.base.SettingsToggle
import ai.kilocode.client.ui.PickerButton
import ai.kilocode.client.ui.UiStyle
import ai.kilocode.client.ui.layout.HAlign
import ai.kilocode.client.ui.layout.Stack
import ai.kilocode.client.ui.layout.VAlign
import ai.kilocode.client.ui.layout.align
import ai.kilocode.client.ui.picker.PickerListRenderer
import ai.kilocode.client.ui.picker.PickerPopup
import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.openapi.application.EDT
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.asContextElement
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.ui.CollectionListModel
import com.intellij.ui.JBIntSpinner
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.Cursor
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import javax.swing.JComponent
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val edt = Dispatchers.EDT + ModalityState.any().asContextElement()
private const val MIN_CONCURRENCY = 1
private const val MAX_CONCURRENCY = 50
private const val DEFAULT_CONCURRENCY = 5
private const val MIN_TIMEOUT = 1
private const val MAX_TIMEOUT = 1440
private const val DEFAULT_TIMEOUT = 30
private const val ESTIMATE_DEBOUNCE_MS = 400L
// mycelis_change - explicit Locale.US symbols; a bare DecimalFormat pattern otherwise uses the
// JVM's default locale's decimal separator (e.g. "," ), which reads oddly paired with a literal "$".
private val COST_FMT = DecimalFormat("$#,##0.00", DecimalFormatSymbols(Locale.US))

/**
 * Single-page create form covering all six fields from the CLI's sequential /deployments wizard
 * (model, name, concurrency, auto-stop + conditional timeout, expose-to-Web-UI, cost estimate).
 * The CLI splits these across separate TUI prompts only because a terminal can show one prompt at
 * a time; here they fit comfortably on one screen.
 */
internal class DeploymentCreateDialog(
    private val cs: CoroutineScope,
    private val directory: String,
    private val models: List<MarketplaceModelDto>,
) : DialogWrapper(true) {
    private var selectedModel: MarketplaceModelDto? = models.firstOrNull()
    private val model = PickerButton().apply {
        cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (models.isEmpty()) return
                showModelPopup()
            }
        })
    }
    private val name = JBTextField()
    private val concurrency = JBIntSpinner(DEFAULT_CONCURRENCY, MIN_CONCURRENCY, MAX_CONCURRENCY)
    private val timeout = JBIntSpinner(DEFAULT_TIMEOUT, MIN_TIMEOUT, MAX_TIMEOUT)
    // mycelis_change - label-above-field, matching the Add Custom Provider dialog's form layout
    // instead of the settings-page SettingsRow (title left, control right) convention.
    private val timeoutRow = Stack.vertical(UiStyle.Gap.sm())
        .next(JBLabel(KiloBundle.message("settings.deployments.create.timeout")))
        .next(timeout)
    private val autoStop = SettingsToggle(false) { syncTimeoutVisibility() }
    private val exposeToWebUi = SettingsToggle(false) {}
    private val estimateLabel = JBLabel(KiloBundle.message("settings.deployments.create.estimateUnavailable")).apply {
        foreground = UIUtil.getContextHelpForeground()
    }
    private var estimateJob: Job? = null
    private var saving = false

    init {
        title = KiloBundle.message("settings.deployments.create.title")
        setOKButtonText(KiloBundle.message("settings.deployments.create.deploy"))
        init()
        initValidation()
        syncModelLabel()
        concurrency.addChangeListener { scheduleEstimate() }
        syncTimeoutVisibility()
        scheduleEstimate()
    }

    private fun syncTimeoutVisibility() {
        timeoutRow.isVisible = autoStop.isSelected
    }

    private fun syncModelLabel() {
        model.text = selectedModel?.let { "${it.name} ▾" } ?: KiloBundle.message("settings.deployments.create.noModels")
    }

    // mycelis_change - a proper search picker instead of a plain ComboBox: the Mycelis GPU
    // marketplace list can be long, and a searchable popup (matches the plugin's ModelPicker
    // pattern) is much faster to narrow down than scrolling a combo box.
    private fun showModelPopup() {
        val data = CollectionListModel(models)
        val renderer = MarketplaceModelRenderer(data) { selectedModel }
        val popup = PickerPopup(
            anchor = model,
            placement = PickerPopup.Placement.BELOW,
            rows = { query -> models.filter { marketplaceMatches(it, query) } },
            model = data,
            renderer = renderer,
            key = { it.id },
            mode = PickerPopup.Mode.Single,
            onPrimary = { item ->
                selectedModel = item
                syncModelLabel()
                scheduleEstimate()
            },
            search = true,
        )
        popup.show()
    }

    private fun scheduleEstimate() {
        estimateJob?.cancel()
        val selected = selectedModel ?: return
        estimateLabel.text = KiloBundle.message("settings.deployments.create.estimating")
        estimateJob = cs.launch {
            delay(ESTIMATE_DEBOUNCE_MS)
            val estimate = try {
                service<KiloDeploymentService>().gpuEstimate(directory, selected.id, concurrency.number)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                LOG.warn("deployment gpu estimate failed model=${selected.id}", e)
                null
            }
            withContext(edt) {
                estimateLabel.text = if (estimate?.costPerHourUsd != null) {
                    KiloBundle.message(
                        "settings.deployments.create.estimatedCost",
                        COST_FMT.format(estimate.costPerHourUsd),
                        estimate.gpuName.orEmpty(),
                    )
                } else {
                    KiloBundle.message("settings.deployments.create.estimateUnavailable")
                }
            }
        }
    }

    override fun createCenterPanel(): JComponent {
        val panel = Stack.vertical(UiStyle.Gap.sm())
        panel.next(JBLabel(KiloBundle.message("settings.deployments.create.model")))
        panel.next(model)
        panel.next(JBLabel(KiloBundle.message("settings.deployments.create.name")))
        panel.next(name)
        panel.next(JBLabel(KiloBundle.message("settings.deployments.create.concurrency")))
        panel.next(descriptionLabel(KiloBundle.message("settings.deployments.create.concurrencyDescription")))
        panel.next(concurrency)
        panel.next(JBLabel(KiloBundle.message("settings.deployments.create.autoStop")))
        panel.next(autoStop.align(HAlign.LEFT, VAlign.TOP))
        panel.next(timeoutRow)
        panel.next(JBLabel(KiloBundle.message("settings.deployments.create.exposeToWebUi")))
        panel.next(descriptionLabel(KiloBundle.message("settings.deployments.create.exposeToWebUiDescription")))
        panel.next(exposeToWebUi.align(HAlign.LEFT, VAlign.TOP))
        panel.next(estimateLabel)
        panel.border = JBUI.Borders.empty(UiStyle.Gap.pad())
        return panel
    }

    private fun descriptionLabel(text: String) = JBLabel(text).apply {
        foreground = UIUtil.getContextHelpForeground()
    }

    override fun doValidate(): ValidationInfo? {
        if (models.isEmpty()) return ValidationInfo(KiloBundle.message("settings.deployments.create.noModels"))
        if (name.text.isBlank()) return ValidationInfo(KiloBundle.message("settings.deployments.create.nameRequired"), name)
        return null
    }

    override fun doOKAction() {
        if (saving) return
        val invalid = doValidate()
        if (invalid != null) {
            setErrorText(invalid.message, invalid.component)
            return
        }
        val selected = selectedModel ?: return
        val input = CreateDeploymentDto(
            directory = directory,
            name = name.text.trim(),
            modelId = selected.id,
            maxConcurrentUsers = concurrency.number.toDouble(),
            autoStopOnInactivity = autoStop.isSelected,
            inactivityTimeoutMinutes = if (autoStop.isSelected) timeout.number.toDouble() else null,
            isExposedToWebUi = exposeToWebUi.isSelected,
        )
        saving = true
        cs.launch {
            val result = try {
                service<KiloDeploymentService>().create(input)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                LOG.warn("deployment create failed name=${input.name}", e)
                withContext(edt) { fail("${e::class.simpleName}: ${e.message}") }
                return@launch
            }
            withContext(edt) {
                val error = result.error
                if (error != null) {
                    fail(error)
                    return@withContext
                }
                close(OK_EXIT_CODE)
            }
        }
    }

    private fun fail(message: String) {
        saving = false
        setErrorText(message)
    }

    private companion object {
        val LOG = KiloLog.create(DeploymentCreateDialog::class.java)
    }
}

private fun marketplaceMatches(model: MarketplaceModelDto, query: String): Boolean {
    if (query.isBlank()) return true
    return model.name.contains(query, ignoreCase = true) || model.provider.contains(query, ignoreCase = true)
}

private class MarketplaceModelRenderer(
    model: CollectionListModel<MarketplaceModelDto>,
    selected: () -> MarketplaceModelDto?,
) : PickerListRenderer<MarketplaceModelDto>(
    model = model,
    checked = { it.id == selected()?.id },
    sectionTitle = { _, _ -> null },
    content = JBLabel(),
) {
    private val label = content as JBLabel

    override fun update(
        value: MarketplaceModelDto,
        index: Int,
        selected: Boolean,
        focused: Boolean,
        foreground: java.awt.Color,
        weak: java.awt.Color,
    ) {
        label.text = "${value.name}  —  ${value.provider} · ${value.vramRequiredGb.toInt()}GB VRAM"
        label.foreground = foreground
    }
}
