// mycelis_change - new file
@file:Suppress("UnstableApiUsage")

package ai.kilocode.backend.rpc

import ai.kilocode.backend.app.KiloBackendAppService
import ai.kilocode.backend.deployment.KiloBackendDeploymentManager
import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.KiloDeploymentRpcApi
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentActionResultDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.GpuEstimateDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.openapi.components.service

internal class KiloDeploymentRpcApiImpl : KiloDeploymentRpcApi {
    companion object {
        private val LOG = KiloLog.create(KiloDeploymentRpcApiImpl::class.java)
    }

    private val manager: KiloBackendDeploymentManager
        get() = KiloBackendDeploymentManager(service<KiloBackendAppService>())

    override suspend fun list(directory: String): DeploymentsStateDto = logged("list dir=$directory") { manager.list(directory) }
    override suspend fun create(input: CreateDeploymentDto): DeploymentActionResultDto = logged("create name=${input.name}") { manager.create(input) }
    override suspend fun start(input: DeploymentActionDto): DeploymentActionResultDto = logged("start id=${input.id}") { manager.start(input) }
    override suspend fun stop(input: DeploymentActionDto): DeploymentActionResultDto = logged("stop id=${input.id}") { manager.stop(input) }
    override suspend fun delete(input: DeploymentActionDto): DeploymentActionResultDto = logged("delete id=${input.id}") { manager.delete(input) }
    override suspend fun marketplaceModels(directory: String, search: String?): List<MarketplaceModelDto> =
        logged("marketplaceModels") { manager.marketplaceModels(directory, search) }
    override suspend fun gpuEstimate(directory: String, modelId: String, concurrentUsers: Int?): GpuEstimateDto =
        logged("gpuEstimate model=$modelId") { manager.gpuEstimate(directory, modelId, concurrentUsers) }

    private suspend fun <T> logged(name: String, block: suspend () -> T): T {
        val start = System.currentTimeMillis()
        LOG.info("deployment rpc $name: start")
        return try {
            val result = block()
            LOG.info("deployment rpc $name: completed durationMs=${System.currentTimeMillis() - start}")
            result
        } catch (e: Exception) {
            LOG.warn("deployment rpc $name: failed durationMs=${System.currentTimeMillis() - start}", e)
            throw e
        }
    }
}
