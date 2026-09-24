// mycelis_change - new file
package ai.kilocode.client.settings.deployments

import ai.kilocode.client.app.KiloDeploymentService
import ai.kilocode.client.plugin.KiloBundle
import ai.kilocode.client.settings.base.SettingsRow
import ai.kilocode.client.settings.base.SettingsToggle
import ai.kilocode.client.ui.UiStyle
import ai.kilocode.client.ui.layout.Stack
import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.openapi.application.EDT
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.asContextElement
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.ui.JBIntSpinner
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.UIUtil
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
    private val model = com.intellij.openapi.ui.ComboBox(models.map { it.name }.toTypedArray())
    private val name = JBTextField()
    private val concurrency = JBIntSpinner(DEFAULT_CONCURRENCY, MIN_CONCURRENCY, MAX_CONCURRENCY)
    private val timeout = JBIntSpinner(DEFAULT_TIMEOUT, MIN_TIMEOUT, MAX_TIMEOUT)
    private val timeoutRow = SettingsRow(KiloBundle.message("settings.deployments.create.timeout"), value = timeout)
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
        model.selectedIndex = 0
        model.addActionListener { scheduleEstimate() }
        concurrency.addChangeListener { scheduleEstimate() }
        syncTimeoutVisibility()
        scheduleEstimate()
    }

    private fun syncTimeoutVisibility() {
        timeoutRow.isVisible = autoStop.isSelected
    }

    private fun selectedModel(): MarketplaceModelDto? = models.getOrNull(model.selectedIndex)

    private fun scheduleEstimate() {
        estimateJob?.cancel()
        val selected = selectedModel() ?: return
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
        return Stack.vertical(UiStyle.Gap.sm())
            .next(SettingsRow(KiloBundle.message("settings.deployments.create.model"), value = model))
            .next(SettingsRow(KiloBundle.message("settings.deployments.create.name"), value = name))
            .next(
                SettingsRow(
                    KiloBundle.message("settings.deployments.create.concurrency"),
                    KiloBundle.message("settings.deployments.create.concurrencyDescription"),
                    concurrency,
                ),
            )
            .next(SettingsRow(KiloBundle.message("settings.deployments.create.autoStop"), value = autoStop))
            .next(timeoutRow)
            .next(
                SettingsRow(
                    KiloBundle.message("settings.deployments.create.exposeToWebUi"),
                    KiloBundle.message("settings.deployments.create.exposeToWebUiDescription"),
                    exposeToWebUi,
                ),
            )
            .next(estimateLabel)
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
        val selected = selectedModel() ?: return
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
