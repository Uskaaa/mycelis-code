// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.rpc.dto.SessionActivityDto
import ai.kilocode.rpc.dto.SessionActivityKindDto
import kotlin.test.Test
import kotlin.test.assertEquals

class SessionAttentionSoundLogicTest {
    @Test
    fun `rising into question or plan triggers the question sound`() {
        for (kind in listOf(SessionActivityKindDto.QUESTION, SessionActivityKindDto.PLAN)) {
            val previous = activity(SessionActivityKindDto.RUNNING)
            val next = activity(kind)

            assertEquals(listOf(AttentionSoundEvent.QUESTION), diffAttentionSound(previous, next), kind.name)
        }
    }

    @Test
    fun `rising into permission triggers the permission sound`() {
        val previous = activity(SessionActivityKindDto.RUNNING)
        val next = activity(SessionActivityKindDto.PERMISSION)

        assertEquals(listOf(AttentionSoundEvent.PERMISSION), diffAttentionSound(previous, next))
    }

    @Test
    fun `rising into error triggers the error sound`() {
        val previous = activity(SessionActivityKindDto.RUNNING)
        val next = activity(SessionActivityKindDto.ERROR)

        assertEquals(listOf(AttentionSoundEvent.ERROR), diffAttentionSound(previous, next))
    }

    @Test
    fun `a running session clearing entirely triggers the done sound`() {
        val previous = activity(SessionActivityKindDto.RUNNING)
        val next = emptyMap<String, SessionActivityDto>()

        assertEquals(listOf(AttentionSoundEvent.DONE), diffAttentionSound(previous, next))
    }

    @Test
    fun `a session clearing out of an attention state does not also trigger done`() {
        val previous = activity(SessionActivityKindDto.PERMISSION)
        val next = emptyMap<String, SessionActivityDto>()

        assertEquals(emptyList(), diffAttentionSound(previous, next))
    }

    @Test
    fun `staying in the same kind triggers nothing`() {
        for (kind in SessionActivityKindDto.entries) {
            val snapshot = activity(kind)

            assertEquals(emptyList(), diffAttentionSound(snapshot, snapshot), kind.name)
        }
    }

    @Test
    fun `a brand new session appearing already running triggers nothing`() {
        val previous = emptyMap<String, SessionActivityDto>()
        val next = activity(SessionActivityKindDto.RUNNING)

        assertEquals(emptyList(), diffAttentionSound(previous, next))
    }

    @Test
    fun `each session in a mixed snapshot is diffed independently`() {
        val previous = mapOf(
            "ses_a" to SessionActivityDto("/repo/a", SessionActivityKindDto.RUNNING),
            "ses_b" to SessionActivityDto("/repo/b", SessionActivityKindDto.RUNNING),
            "ses_c" to SessionActivityDto("/repo/c", SessionActivityKindDto.PERMISSION),
        )
        val next = mapOf(
            "ses_a" to SessionActivityDto("/repo/a", SessionActivityKindDto.ERROR),
            // ses_b cleared entirely -> done.
            "ses_c" to SessionActivityDto("/repo/c", SessionActivityKindDto.PERMISSION),
        )

        assertEquals(
            listOf(AttentionSoundEvent.ERROR, AttentionSoundEvent.DONE),
            diffAttentionSound(previous, next),
        )
    }

    private fun activity(kind: SessionActivityKindDto) =
        mapOf("ses_1" to SessionActivityDto("/repo/wt", kind))
}
