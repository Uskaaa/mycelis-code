// mycelis_change - new file
package ai.kilocode.client.attention

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

/**
 * The notification sound Kilo plays when a session finishes or needs your input, set via
 * [ai.kilocode.client.attention.NotificationSoundDialog] (action: Set Notification Sound).
 * IDE-level, like [ai.kilocode.client.actions.SessionAutoApproveAction]'s auto-approve setting -
 * one choice shared by every session and project in this IDE, not per session.
 */
@Service(Service.Level.APP)
@State(
    name = "KiloAttentionSoundSettings",
    storages = [Storage("kiloAttentionSound.xml")],
)
internal class AttentionSoundSettings : PersistentStateComponent<AttentionSoundSettings.State> {

    data class State(var soundID: String? = null)

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    /** No sound plays until the user explicitly picks one - matches kilo-vscode's opt-in default. */
    var soundID: String
        get() = state.soundID ?: OFF
        set(value) {
            state.soundID = value
        }

    companion object {
        const val OFF = "off"
        fun getInstance(): AttentionSoundSettings = service()
    }
}
