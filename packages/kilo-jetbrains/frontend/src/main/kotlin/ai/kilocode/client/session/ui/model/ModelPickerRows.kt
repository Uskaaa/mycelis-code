package ai.kilocode.client.session.ui.model

import ai.kilocode.client.plugin.KiloBundle
import ai.kilocode.rpc.dto.ModelSelectionDto

internal fun modelPickerRows(
    items: List<ModelPicker.Item>,
    favorites: List<ModelSelectionDto>,
    query: String,
    allowEmpty: Boolean = false,
    emptyText: String = KiloBundle.message("settings.models.notSet"),
    includeSmall: Boolean = false,
    // mycelis_change - when set, each provider group is preceded by a clickable header row and its
    // models are dropped while the provider is in [collapsed] (never while searching).
    collapsible: Boolean = false,
    collapsed: Set<String> = emptySet(),
): List<ModelPickerRow> {
    val q = query.trim()
    val all = if (includeSmall) items else items.filterNot(ModelText::small)
    val filtered = all.filter {
        ModelSearch.matches(q, it.display) || ModelSearch.matches(q, it.id) || ModelSearch.matches(q, it.providerName)
    }
    val recommended = filtered
        .filter { it.recommendedIndex != null }
        .sortedWith(compareBy<ModelPicker.Item> { it.recommendedIndex }.thenBy { it.display.lowercase() }.thenBy { it.id })
    val grouped = filtered
        .filter { it.recommendedIndex == null }
        .groupBy { it.provider }
        .toList()
        .sortedWith(compareBy<Pair<String, List<ModelPicker.Item>>> { ModelText.providerSort(it.first) })
    val out = mutableListOf<ModelPickerRow>()
    if (allowEmpty && ModelSearch.matches(q, emptyText)) {
        out += ModelPickerRow(null, null, favorite = false, emptyText = emptyText)
    }
    if (q.isBlank()) {
        val byKey = all.associateBy { it.key }
        val fav = favorites.map { "${it.providerID}/${it.modelID}" }.mapNotNull(byKey::get)
        if (fav.isNotEmpty()) {
            val section = KiloBundle.message("model.picker.favorites")
            out += fav.map { ModelPickerRow(it, section, favorite = true) }
        }
    }
    if (recommended.isNotEmpty()) {
        val section = KiloBundle.message("model.picker.recommended")
        out += recommended.map { ModelPickerRow(it, section, favorite = false) }
    }
    for ((provider, list) in grouped) {
        val sorted = list.sortedWith(compareBy<ModelPicker.Item> { it.display.lowercase() }.thenBy { it.id })
        val label = sorted.firstOrNull()?.providerName ?: continue
        if (!collapsible) {
            out += sorted.map { ModelPickerRow(it, label, favorite = false) }
            continue
        }
        val fold = q.isBlank() && provider in collapsed
        out += ModelPickerRow(null, label, favorite = false, emptyText = label, header = true, folded = fold, count = sorted.size, group = provider)
        if (!fold) out += sorted.map { ModelPickerRow(it, label, favorite = false) }
    }
    return out
}

/**
 * Ordered list of models the Ctrl+2 cycle shortcut steps through: favorites (in favorites order) when
 * any exist, otherwise the picker's Recommended section (sorted by [ModelPicker.Item.recommendedIndex]).
 * Empty when neither is available.
 */
internal fun modelCycle(
    items: List<ModelPicker.Item>,
    favorites: List<ModelSelectionDto>,
    includeSmall: Boolean = false,
): List<ModelPicker.Item> {
    val all = if (includeSmall) items else items.filterNot(ModelText::small)
    val byKey = all.associateBy { it.key }
    val fav = favorites.map { "${it.providerID}/${it.modelID}" }.mapNotNull(byKey::get)
    if (fav.isNotEmpty()) return fav
    return all
        .filter { it.recommendedIndex != null }
        .sortedWith(compareBy<ModelPicker.Item> { it.recommendedIndex }.thenBy { it.display.lowercase() }.thenBy { it.id })
}

internal fun modelPickerIndex(rows: List<ModelPickerRow>, key: String?): Int {
    if (key == null) return rows.indexOfFirst { it.item == null && !it.header }
    return rows.indexOfFirst { it.item?.key == key }
}

internal fun modelPickerIndex(rows: List<ModelPickerRow>, index: Int): Int {
    if (rows.isEmpty()) return -1
    return index.coerceIn(0, rows.lastIndex)
}

internal fun modelPickerSectionTitle(rows: List<ModelPickerRow>, index: Int): String? {
    val row = rows.getOrNull(index) ?: return null
    // A provider header row draws its own label, so it needs no separator caption on top of it.
    if (row.header) return null
    val section = row.section ?: return null
    val prev = rows.getOrNull(index - 1)
    return if (prev?.section != section) section else null
}
