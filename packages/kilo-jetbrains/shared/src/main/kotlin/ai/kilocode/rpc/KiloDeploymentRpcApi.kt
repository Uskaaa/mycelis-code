// mycelis_change - new file
@file:Suppress("UnstableApiUsage")

package ai.kilocode.rpc

import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentActionResultDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.GpuEstimateDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.platform.rpc.RemoteApiProviderService
import fleet.rpc.RemoteApi
import fleet.rpc.Rpc
import fleet.rpc.remoteApiDescriptor

@Rpc
interface KiloDeploymentRpcApi : RemoteApi<Unit> {
    companion object {
        suspend fun getInstance(): KiloDeploymentRpcApi {
            return RemoteApiProviderService.resolve(remoteApiDescriptor<KiloDeploymentRpcApi>())
        }
    }

    suspend fun list(directory: String): DeploymentsStateDto
    suspend fun create(input: CreateDeploymentDto): DeploymentActionResultDto
    suspend fun start(input: DeploymentActionDto): DeploymentActionResultDto
    suspend fun stop(input: DeploymentActionDto): DeploymentActionResultDto
    suspend fun delete(input: DeploymentActionDto): DeploymentActionResultDto
    suspend fun marketplaceModels(directory: String, search: String? = null): List<MarketplaceModelDto>
    suspend fun gpuEstimate(directory: String, modelId: String, concurrentUsers: Int? = null): GpuEstimateDto
}
