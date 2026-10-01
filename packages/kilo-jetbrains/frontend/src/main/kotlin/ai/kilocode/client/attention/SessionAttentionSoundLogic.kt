// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.rpc.dto.SessionActivityDto
import ai.kilocode.rpc.dto.SessionActivityKindDto

/**
 * Diffs two [ai.kilocode.client.app.KiloSessionService.activity] snapshots and returns the sound
 * events any session's transition should trigger. Pure and stateless per call - the caller folds
 * this over the live flow (see [SessionAttentionSoundService]).
 *
 * - A session newly in an attention state (QUESTION/PLAN -> "question", PERMISSION ->
 *   "permission", ERROR -> "error") triggers once, on the transition into it - not on every
 *   repeated snapshot while it is still waiting. `activity` already holds a short grace period
 *   before publishing a rising attention state (see its own doc comment), so a permission the
 *   client auto-approves itself never reaches here at all.
 * - A session that was RUNNING and clears entirely (absent from `next`, not moved into an
 *   attention state) triggers "done" - a turn that finished with nothing left for the user to
 *   look at. A session clearing out of QUESTION/PERMISSION/ERROR instead (answered, or a retry
 *   recovered) does not additionally trigger "done".
 */
internal fun diffAttentionSound(
    previous: Map<String, SessionActivityDto>,
    next: Map<String, SessionActivityDto>,
): List<AttentionSoundEvent> {
    val events = mutableListOf<AttentionSoundEvent>()
    for ((id, dto) in next) {
        if (previous[id]?.kind == dto.kind) continue
        when (dto.kind) {
            SessionActivityKindDto.QUESTION, SessionActivityKindDto.PLAN -> events += AttentionSoundEvent.QUESTION
            SessionActivityKindDto.PERMISSION -> events += AttentionSoundEvent.PERMISSION
            SessionActivityKindDto.ERROR -> events += AttentionSoundEvent.ERROR
            SessionActivityKindDto.RUNNING -> Unit
        }
    }
    for ((id, dto) in previous) {
        if (dto.kind == SessionActivityKindDto.RUNNING && id !in next) events += AttentionSoundEvent.DONE
    }
    return events
}
