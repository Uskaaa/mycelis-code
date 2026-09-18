package ai.kilocode.client.session.ui.model

import ai.kilocode.rpc.dto.ModelDto
import ai.kilocode.rpc.dto.ProviderDto
import ai.kilocode.rpc.dto.ProvidersDto
import com.intellij.testFramework.fixtures.BasePlatformTestCase

class ModelItemsTest : BasePlatformTestCase() {

    private fun providers(): ProvidersDto = ProvidersDto(
        providers = listOf(
            ProviderDto(
                "kilo", "Kilo",
                models = mapOf(
                    "gpt-5" to ModelDto("gpt-5", "GPT-5", variants = listOf("low", "high"), attachment = true),
                    "auto-small" to ModelDto("auto-small", "Auto Small"),
                ),
            ),
            ProviderDto("openai", "OpenAI", models = mapOf("o3" to ModelDto("o3", "o3"))),
            ProviderDto("anthropic", "Anthropic", models = mapOf("claude" to ModelDto("claude", "Claude"))),
        ),
        connected = listOf("openai"),
        defaults = emptyMap(),
    )

    // mycelis_change - was "test drops small models and providers that are not connected": BYOK
    // providers (openai here, even though connected) are now always excluded, not just
    // unconnected ones - Mycelis is the only supported sign-in path.
    fun `test drops small models and every non-kilo provider`() {
        assertEquals(listOf("kilo/gpt-5"), modelItems(providers()).map { it.key })
    }

    fun `test keeps small models when requested`() {
        assertEquals(
            setOf("kilo/gpt-5", "kilo/auto-small"),
            modelItems(providers(), includeSmall = true).map { it.key }.toSet(),
        )
    }

    fun `test carries variants and attachment onto the item`() {
        val gpt = modelItems(providers()).first { it.key == "kilo/gpt-5" }
        assertEquals(listOf("low", "high"), gpt.variants)
        assertTrue(gpt.attachment)
    }

    fun `test null providers yields no items`() {
        assertTrue(modelItems(null).isEmpty())
    }

    // mycelis_change - a provider the user explicitly set up in their own kilo.jsonc (source
    // "config") is exempt from the Mycelis-only filter, unlike auto-discovered "openai" above.
    fun `test keeps a provider explicitly configured by the user`() {
        val configured = ProvidersDto(
            providers = listOf(
                ProviderDto("kilo", "Kilo", models = mapOf("gpt-5" to ModelDto("gpt-5", "GPT-5"))),
                ProviderDto(
                    "custom-anthropic",
                    "Custom Anthropic",
                    source = "config",
                    models = mapOf("claude" to ModelDto("claude", "Claude")),
                ),
                ProviderDto("openai", "OpenAI", models = mapOf("o3" to ModelDto("o3", "o3"))),
            ),
            connected = listOf("openai"),
            defaults = emptyMap(),
        )
        assertEquals(
            setOf("kilo/gpt-5", "custom-anthropic/claude"),
            modelItems(configured).map { it.key }.toSet(),
        )
    }
}
