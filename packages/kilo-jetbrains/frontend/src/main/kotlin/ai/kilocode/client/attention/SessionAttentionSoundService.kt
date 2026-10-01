// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.client.app.KiloSessionService
import ai.kilocode.rpc.dto.SessionActivityDto
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Plays the configured [AttentionSoundSettings.soundID] whenever a session transitions into an
 * attention state or finishes, across every session this project's [KiloSessionService] tracks.
 *
 * A light project service: [KiloToolWindowFactory][ai.kilocode.client.KiloToolWindowFactory]
 * requests it once (like it already does for the tab dot and tool-window badge, off the same
 * `activity` flow) purely to force this constructor to run - nothing else calls it directly.
 */
@Service(Service.Level.PROJECT)
internal class SessionAttentionSoundService(project: Project, cs: CoroutineScope) {
    init {
        cs.launch {
            var previous = emptyMap<String, SessionActivityDto>()
            project.service<KiloSessionService>().activity.collect { next ->
                val id = AttentionSoundSettings.getInstance().soundID
                if (id != AttentionSoundSettings.OFF) {
                    diffAttentionSound(previous, next).forEach { AttentionSoundPlayer.play(it, id) }
                }
                previous = next
            }
        }
    }
}
