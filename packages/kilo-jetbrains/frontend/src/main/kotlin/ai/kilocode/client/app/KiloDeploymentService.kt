// mycelis_change - new file
@file:Suppress("UnstableApiUsage")

package ai.kilocode.client.app

import ai.kilocode.log.KiloLog
import ai.kilocode.rpc.KiloDeploymentRpcApi
import ai.kilocode.rpc.dto.CreateDeploymentDto
import ai.kilocode.rpc.dto.DeploymentActionDto
import ai.kilocode.rpc.dto.DeploymentActionResultDto
import ai.kilocode.rpc.dto.DeploymentsStateDto
import ai.kilocode.rpc.dto.GpuEstimateDto
import ai.kilocode.rpc.dto.LoadErrorDto
import ai.kilocode.rpc.dto.MarketplaceModelDto
import com.intellij.openapi.components.Service
import fleet.rpc.client.durable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.withTimeout

@Service(Service.Level.APP)
class KiloDeploymentService internal constructor(
    private val cs: CoroutineScope,
    private val rpc: KiloDeploymentRpcApi?,
) {
    constructor(cs: CoroutineScope) : this(cs, null)

    companion object {
        private val LOG = KiloLog.create(KiloDeploymentService::class.java)
        private const val RPC_TIMEOUT_MS = 20_000L
    }

    private suspend fun <T> call(name: String, block: suspend KiloDeploymentRpcApi.() -> T): T {
        val start = System.currentTimeMillis()
        LOG.info("deployment rpc $name: start")
        val api = rpc
        return try {
            val result = withTimeout(RPC_TIMEOUT_MS) {
                if (api != null) block(api) else durable { block(KiloDeploymentRpcApi.getInstance()) }
            }
            LOG.info("deployment rpc $name: completed durationMs=${System.currentTimeMillis() - start}")
            result
        } catch (e: Exception) {
            LOG.warn("deployment rpc $name: failed durationMs=${System.currentTimeMillis() - start}", e)
            throw e
        }
    }

    suspend fun list(directory: String): DeploymentsStateDto = try {
        call("list dir=$directory") { list(directory) }
    } catch (e: Exception) {
        LOG.warn("deployment list failed for directory=$directory", e)
        DeploymentsStateDto(errors = listOf(LoadErrorDto(resource = "deployments", detail = e.message)))
    }

    suspend fun create(input: CreateDeploymentDto): DeploymentActionResultDto = action(input.directory) { create(input) }
    suspend fun start(input: DeploymentActionDto): DeploymentActionResultDto = action(input.directory) { start(input) }
    suspend fun stop(input: DeploymentActionDto): DeploymentActionResultDto = action(input.directory) { stop(input) }
    suspend fun delete(input: DeploymentActionDto): DeploymentActionResultDto = action(input.directory) { delete(input) }
    suspend fun marketplaceModels(directory: String, search: String? = null): List<MarketplaceModelDto> =
        call("marketplaceModels") { marketplaceModels(directory, search) }
    suspend fun gpuEstimate(directory: String, modelId: String, concurrentUsers: Int? = null): GpuEstimateDto =
        call("gpuEstimate model=$modelId") { gpuEstimate(directory, modelId, concurrentUsers) }

    private suspend fun action(directory: String, block: suspend KiloDeploymentRpcApi.() -> DeploymentActionResultDto): DeploymentActionResultDto = try {
        call("action dir=$directory", block)
    } catch (e: Exception) {
        LOG.warn("deployment action failed for directory=$directory", e)
        DeploymentActionResultDto(state = list(directory), error = e.message)
    }
}
