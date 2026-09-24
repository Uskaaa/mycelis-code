// mycelis_change - new file
package ai.kilocode.rpc.dto

import kotlinx.serialization.Serializable

@Serializable
data class DeploymentDto(
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
)

@Serializable
data class MarketplaceModelDto(
    val id: String,
    val name: String,
    val provider: String,
    val description: String,
    val vramRequiredGb: Double,
)

@Serializable
data class GpuEstimateDto(
    val modelId: String,
    val gpuTypeId: String? = null,
    val gpuName: String? = null,
    val costPerHourUsd: Double? = null,
    val memoryInGb: Double? = null,
)

@Serializable
data class CreateDeploymentDto(
    val directory: String,
    val name: String,
    val modelId: String,
    val maxConcurrentUsers: Double? = null,
    val autoStopOnInactivity: Boolean? = null,
    val inactivityTimeoutMinutes: Double? = null,
    val isExposedToWebUi: Boolean? = null,
)

@Serializable
data class DeploymentActionDto(
    val directory: String,
    val id: String,
)

@Serializable
data class DeploymentsStateDto(
    val deployments: List<DeploymentDto> = emptyList(),
    val errors: List<LoadErrorDto> = emptyList(),
)

@Serializable
data class DeploymentActionResultDto(
    val state: DeploymentsStateDto,
    val error: String? = null,
)
