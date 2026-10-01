// mycelis_change - new file
package ai.kilocode.client.actions

import ai.kilocode.client.attention.NotificationSoundDialog
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.progress.currentThreadCoroutineScope
import com.intellij.openapi.project.DumbAware

/** Opens [NotificationSoundDialog] to choose the sound Kilo plays when done or needing input. */
class SetNotificationSoundAction : AnAction(), DumbAware {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.EDT

    override fun actionPerformed(e: AnActionEvent) {
        NotificationSoundDialog(currentThreadCoroutineScope()).show()
    }
}
