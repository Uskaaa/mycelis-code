// mycelis_change - new file
package ai.kilocode.client.testing

import ai.kilocode.rpc.KiloDeploymentRpcApi
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentActionResultDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.GpuEstimateDto
import ai.kilocode.rpc.dto.MarketplaceModelDto

class FakeDeploymentRpcApi : KiloDeploymentRpcApi {
    var state = DeploymentsStateDto()
    val listCalls = mutableListOf<String>()
    val creates = mutableListOf<CreateDeploymentDto>()
    val starts = mutableListOf<DeploymentActionDto>()
    val stops = mutableListOf<DeploymentActionDto>()
    val deletes = mutableListOf<DeploymentActionDto>()
    val marketplaceCalls = mutableListOf<String?>()
    val gpuEstimateCalls = mutableListOf<String>()
    var marketplaceResult = emptyList<MarketplaceModelDto>()
    var gpuEstimateResult = GpuEstimateDto(modelId = "")
    var actionError: Exception? = null

    override suspend fun list(directory: String): DeploymentsStateDto {
        assertNotEdt("deployment.list")
        listCalls.add(directory)
        return state
    }

    override suspend fun create(input: CreateDeploymentDto): DeploymentActionResultDto {
        assertNotEdt("deployment.create")
        creates.add(input)
        actionError?.let { throw it }
        return DeploymentActionResultDto(state)
    }

    override suspend fun start(input: DeploymentActionDto): DeploymentActionResultDto {
        assertNotEdt("deployment.start")
        starts.add(input)
        actionError?.let { throw it }
        return DeploymentActionResultDto(state)
    }

    override suspend fun stop(input: DeploymentActionDto): DeploymentActionResultDto {
        assertNotEdt("deployment.stop")
        stops.add(input)
        actionError?.let { throw it }
        return DeploymentActionResultDto(state)
    }

    override suspend fun delete(input: DeploymentActionDto): DeploymentActionResultDto {
        assertNotEdt("deployment.delete")
        deletes.add(input)
        actionError?.let { throw it }
        return DeploymentActionResultDto(state)
    }

    override suspend fun marketplaceModels(directory: String, search: String?): List<MarketplaceModelDto> {
        assertNotEdt("deployment.marketplaceModels")
        marketplaceCalls.add(search)
        return marketplaceResult
    }

    override suspend fun gpuEstimate(directory: String, modelId: String, concurrentUsers: Int?): GpuEstimateDto {
        assertNotEdt("deployment.gpuEstimate")
        gpuEstimateCalls.add(modelId)
        return gpuEstimateResult
    }
}
