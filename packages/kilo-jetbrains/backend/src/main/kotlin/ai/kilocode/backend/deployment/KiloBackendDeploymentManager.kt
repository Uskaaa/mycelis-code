// mycelis_change - new file
package ai.kilocode.backend.deployment

import ai.kilocode.backend.app.KiloBackendAppService
import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentActionResultDto
import ai.kilocode.rpc.dto.DeploymentDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.GpuEstimateDto
import ai.kilocode.rpc.dto.LoadErrorDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.openapi.components.service
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Talks to the CLI's Mycelis deployment routes (`/kilo/deployments*`). Wire shapes here are 1:1
 * matches for the shared DTOs, so this decodes into module-local Wire* types rather than
 * hand-parsing JsonObjects - see KiloBackendMarketplaceManager's WireResult for why a module-local
 * type is required instead of decoding directly into a shared DTO.
 */
class KiloBackendDeploymentManager(private val backend: KiloBackendAppService? = null) {
    private val app: KiloBackendAppService get() = backend ?: service()

    suspend fun list(directory: String): DeploymentsStateDto {
        val errors = mutableListOf<LoadErrorDto>()
        val deployments = try {
            val text = request(directory, "GET", "/kilo/deployments", null)
            JSON.decodeFromString<List<WireDeployment>>(text).map { it.toDto() }
        } catch (e: Exception) {
            LOG.warn("deployment list failed dir=$directory", e)
            errors.add(LoadErrorDto(resource = "deployments", detail = e.message))
            emptyList()
        }
        return DeploymentsStateDto(deployments = deployments, errors = errors)
    }

    suspend fun create(input: CreateDeploymentDto): DeploymentActionResultDto {
        val body = JSON.encodeToString(
            WireCreate.serializer(),
            WireCreate(
                name = input.name,
                modelId = input.modelId,
                maxConcurrentUsers = input.maxConcurrentUsers,
                autoStopOnInactivity = input.autoStopOnInactivity,
                inactivityTimeoutMinutes = input.inactivityTimeoutMinutes,
                isExposedToWebUi = input.isExposedToWebUi,
            ),
        )
        return mutate(input.directory, "create") { request(input.directory, "POST", "/kilo/deployments", body) }
    }

    suspend fun start(input: DeploymentActionDto): DeploymentActionResultDto =
        mutate(input.directory, "start") { request(input.directory, "POST", "/kilo/deployments/${enc(input.id)}/start", "{}") }

    suspend fun stop(input: DeploymentActionDto): DeploymentActionResultDto =
        mutate(input.directory, "stop") { request(input.directory, "POST", "/kilo/deployments/${enc(input.id)}/stop", "{}") }

    suspend fun delete(input: DeploymentActionDto): DeploymentActionResultDto =
        mutate(input.directory, "delete") { request(input.directory, "DELETE", "/kilo/deployments/${enc(input.id)}", null) }

    suspend fun marketplaceModels(directory: String, search: String?): List<MarketplaceModelDto> {
        val query = if (search.isNullOrBlank()) "" else "&search=${enc(search)}"
        val text = request(directory, "GET", "/kilo/deployments/marketplace-models", null, query)
        return JSON.decodeFromString<List<WireMarketplaceModel>>(text).map { it.toDto() }
    }

    suspend fun gpuEstimate(directory: String, modelId: String, concurrentUsers: Int?): GpuEstimateDto {
        val query = "&modelId=${enc(modelId)}" + (concurrentUsers?.let { "&concurrentUsers=$it" } ?: "")
        val text = request(directory, "GET", "/kilo/deployments/gpu-estimate", null, query)
        return JSON.decodeFromString<WireGpuEstimate>(text).toDto()
    }

    /** Runs a mutating call, then refetches [list] regardless of outcome so the caller always gets fresh state. */
    private suspend fun mutate(directory: String, action: String, call: suspend () -> String): DeploymentActionResultDto {
        val error = try {
            call()
            null
        } catch (e: Exception) {
            LOG.warn("deployment $action failed dir=$directory", e)
            e.message ?: "Deployment $action failed"
        }
        return DeploymentActionResultDto(state = list(directory), error = error)
    }

    private suspend fun request(directory: String, method: String, path: String, body: String?, extraQuery: String = ""): String =
        withContext(Dispatchers.IO) {
            val http = app.http ?: throw IllegalStateException("Kilo HTTP client is unavailable")
            val url = "http://127.0.0.1:${app.port}$path?directory=${enc(directory)}$extraQuery"
            val builder = Request.Builder().url(url)
            when (method) {
                "POST" -> builder.post((body ?: "{}").toRequestBody(JSON_MEDIA))
                "DELETE" -> builder.delete()
                else -> builder.get()
            }
            http.newCall(builder.build()).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    LOG.warn("deployment request failed: $method $path HTTP ${response.code} $text")
                    throw RuntimeException("HTTP ${response.code}: ${text.ifBlank { "no response body" }}")
                }
                text.ifBlank { "null" }
            }
        }

    private fun enc(value: String) = URLEncoder.encode(value, StandardCharsets.UTF_8)

    @Serializable
    private data class WireDeployment(
        val id: String,
        val name: String,
        val slug: String,
        val modelId: String,
        val modelName: String,
        val status: String,
        val accessUrl: String? = null,
        val maxConcurrentUsers: Double,
        val costPerHour: Double,
        val workspaceId: String? = null,
    ) {
        fun toDto() = DeploymentDto(id, name, slug, modelId, modelName, status, accessUrl, maxConcurrentUsers, costPerHour, workspaceId)
    }

    @Serializable
    private data class WireCreate(
        val name: String,
        val modelId: String,
        val maxConcurrentUsers: Double? = null,
        val autoStopOnInactivity: Boolean? = null,
        val inactivityTimeoutMinutes: Double? = null,
        val isExposedToWebUi: Boolean? = null,
    )

    @Serializable
    private data class WireMarketplaceModel(
        val id: String,
        val name: String,
        val provider: String,
        val description: String,
        val vramRequiredGb: Double,
    ) {
        fun toDto() = MarketplaceModelDto(id, name, provider, description, vramRequiredGb)
    }

    @Serializable
    private data class WireGpuEstimate(
        val modelId: String,
        val gpuTypeId: String? = null,
        val gpuName: String? = null,
        val costPerHourUsd: Double? = null,
        val memoryInGb: Double? = null,
    ) {
        fun toDto() = GpuEstimateDto(modelId, gpuTypeId, gpuName, costPerHourUsd, memoryInGb)
    }

    private companion object {
        val LOG = KiloLog.create(KiloBackendDeploymentManager::class.java)
        val JSON = Json { ignoreUnknownKeys = true }
        val JSON_MEDIA = "application/json".toMediaType()
    }
}
