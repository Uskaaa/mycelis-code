// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.client.plugin.KiloBundle
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.CollectionListModel
import com.intellij.ui.ColoredListCellRenderer
import com.intellij.ui.ScrollPaneFactory
import com.intellij.ui.components.JBList
import com.intellij.util.ui.JBUI
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.awt.BorderLayout
import javax.swing.JComponent
import javax.swing.JList
import javax.swing.JPanel

/**
 * "Set Notification Sound" dialog (action: [ai.kilocode.client.actions.SetNotificationSoundAction]).
 * A plain list rather than [ai.kilocode.client.ui.picker.PickerPopup] - that popup anchors under a
 * trigger button for an inline settings row; this is its own standalone, modal entry point instead,
 * reachable straight from the Kilo menu without opening a settings page first.
 */
internal class NotificationSoundDialog(private val cs: CoroutineScope) : DialogWrapper(true) {
    private val model = CollectionListModel(AttentionSoundIDs)
    private val list = JBList(model).apply {
        selectedIndex = AttentionSoundIDs.indexOf(AttentionSoundSettings.getInstance().soundID).coerceAtLeast(0)
        visibleRowCount = 14
        cellRenderer = object : ColoredListCellRenderer<String>() {
            override fun customizeCellRenderer(
                list: JList<out String>,
                value: String,
                index: Int,
                selected: Boolean,
                focused: Boolean,
            ) {
                append(attentionSoundLabel(value))
            }
        }
        addListSelectionListener { if (!it.valueIsAdjusting) preview() }
    }

    init {
        title = KiloBundle.message("attention.sound.dialog.title")
        setOKButtonText(KiloBundle.message("attention.sound.dialog.set"))
        init()
    }

    private fun preview() {
        val id = list.selectedValue ?: return
        cs.launch { AttentionSoundPlayer.preview(id) }
    }

    override fun createCenterPanel(): JComponent {
        val scroll = ScrollPaneFactory.createScrollPane(list)
        scroll.preferredSize = JBUI.size(320, 340)
        return JPanel(BorderLayout()).apply { add(scroll, BorderLayout.CENTER) }
    }

    override fun getPreferredFocusedComponent(): JComponent = list

    override fun doOKAction() {
        list.selectedValue?.let { AttentionSoundSettings.getInstance().soundID = it }
        super.doOKAction()
    }
}
