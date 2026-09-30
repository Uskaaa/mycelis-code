package ai.kilocode.client.session.ui.account

import ai.kilocode.client.session.ui.PickerRow
import ai.kilocode.client.ui.UiStyle
import com.intellij.icons.AllIcons
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.EmptyIcon
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.BorderLayout
import java.awt.Component
import javax.swing.JList
import javax.swing.JPanel
import javax.swing.ListCellRenderer
import javax.swing.SwingConstants

internal class AccountPickerRenderer(
    private val active: () -> String?,
) : JPanel(BorderLayout()), ListCellRenderer<AccountChoice> {
    companion object {
        val checked: javax.swing.Icon = AllIcons.Actions.Checked
        val empty: javax.swing.Icon = EmptyIcon.create(checked)
    }

    private val icon = JBLabel().apply {
        horizontalAlignment = SwingConstants.CENTER
        verticalAlignment = SwingConstants.CENTER
    }
    private val title = JBLabel().apply {
        horizontalAlignment = SwingConstants.LEFT
        verticalAlignment = SwingConstants.CENTER
    }
    private val row = JPanel(BorderLayout(UiStyle.Gap.sm(), 0))
    private val wrap = PickerRow()

    init {
        UiStyle.Components.transparent(this, icon, title, row)
        // mycelis_change - tighter padding: the popup and the row inset already add their own margin
        row.border = JBUI.Borders.empty(
            UiStyle.Gap.sm(),
            UiStyle.Gap.xs(),
            UiStyle.Gap.sm(),
            UiStyle.Gap.md(),
        )
        row.add(icon, BorderLayout.WEST)
        row.add(title, BorderLayout.CENTER)
        wrap.setContent(row)
        add(wrap, BorderLayout.CENTER)
    }

    override fun getListCellRendererComponent(
        list: JList<out AccountChoice>,
        value: AccountChoice,
        index: Int,
        selected: Boolean,
        focused: Boolean,
    ): Component {
        val focus = selected || list.hasFocus() || focused
        val fg = UIUtil.getListForeground(selected, focus)
        background = list.background
        wrap.update(list, selected, focus)
        icon.icon = icon(value)
        title.text = value.title
        title.foreground = fg
        return this
    }

    internal fun icon(value: AccountChoice): javax.swing.Icon =
        if (value.org == active()) checked else empty
}
