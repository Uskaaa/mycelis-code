// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.log.KiloLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.awt.Toolkit
import java.io.BufferedInputStream
import java.util.concurrent.ConcurrentHashMap
import javax.sound.sampled.AudioSystem
import javax.sound.sampled.Clip
import javax.sound.sampled.LineEvent

/** The sound events kilo-vscode's `TuiAttentionSoundName` names; see `files` in its `sound.ts`. */
internal enum class AttentionSoundEvent { QUESTION, PERMISSION, ERROR, DONE }

/**
 * Plays a bundled WAV resource (`/audio-wav/<id>.wav`) via `javax.sound.sampled`, unlike
 * kilo-vscode's approach of shelling out to a platform-specific player command - the JVM already
 * has a built-in, cross-platform audio API, so there is no OS-specific command list to maintain.
 */
internal object AttentionSoundPlayer {
    private val log = KiloLog.create(AttentionSoundPlayer::class.java)

    // Keeps a clip's native line open and its reference alive for the (short) duration of
    // playback - the JVM would otherwise be free to finalize and close it as soon as `play()`
    // returns, since a `Clip` is a normal GC root only for as long as something references it.
    private val playing = ConcurrentHashMap.newKeySet<Clip>()
    private const val CONCURRENCY_LIMIT = 3

    private fun defaultFor(event: AttentionSoundEvent) = when (event) {
        AttentionSoundEvent.QUESTION -> "bip-bop-03"
        AttentionSoundEvent.PERMISSION -> "staplebops-06"
        AttentionSoundEvent.ERROR -> "nope-03"
        AttentionSoundEvent.DONE -> "bip-bop-01"
    }

    /** Plays [soundID] for [event] ("default" resolves through [defaultFor]; "off" is silent). */
    suspend fun play(event: AttentionSoundEvent, soundID: String) {
        if (soundID == AttentionSoundSettings.OFF) return
        if (soundID == "system") return beep()
        val id = if (soundID == "default") defaultFor(event) else soundID
        playFile(id)
    }

    /** Previews [soundID] in the sound picker dialog; "default" previews as the "done" sound. */
    suspend fun preview(soundID: String) = play(AttentionSoundEvent.DONE, soundID)

    private suspend fun beep() = withContext(Dispatchers.IO) {
        Toolkit.getDefaultToolkit().beep()
    }

    private suspend fun playFile(id: String) = withContext(Dispatchers.IO) {
        if (playing.size >= CONCURRENCY_LIMIT) return@withContext
        val resource = "/audio-wav/$id.wav"
        val stream = AttentionSoundPlayer::class.java.getResourceAsStream(resource)
        if (stream == null) {
            log.warn("Notification sound resource missing: $resource")
            return@withContext
        }
        try {
            val clip = AudioSystem.getClip()
            playing += clip
            clip.addLineListener { event ->
                if (event.type == LineEvent.Type.STOP) {
                    clip.close()
                    playing -= clip
                }
            }
            clip.open(AudioSystem.getAudioInputStream(BufferedInputStream(stream)))
            clip.start()
        } catch (e: Exception) {
            log.warn("Failed to play notification sound: $resource", e)
        }
    }
}
