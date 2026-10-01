// mycelis_change - new file
package ai.kilocode.client.attention

import ai.kilocode.client.plugin.KiloBundle

/** Bundled custom sound IDs, mirroring kilo-vscode's `CustomSoundIDs` (same WAV files). */
internal val CustomSoundIDs = listOf(
    "alert-01",
    "alert-02",
    "alert-03",
    "alert-04",
    "alert-05",
    "alert-06",
    "alert-07",
    "alert-08",
    "alert-09",
    "alert-10",
    "bip-bop-01",
    "bip-bop-02",
    "bip-bop-03",
    "bip-bop-04",
    "bip-bop-05",
    "bip-bop-06",
    "bip-bop-07",
    "bip-bop-08",
    "bip-bop-09",
    "bip-bop-10",
    "staplebops-01",
    "staplebops-02",
    "staplebops-03",
    "staplebops-04",
    "staplebops-05",
    "staplebops-06",
    "staplebops-07",
    "nope-01",
    "nope-02",
    "nope-03",
    "nope-04",
    "nope-05",
    "nope-06",
    "nope-07",
    "nope-08",
    "nope-09",
    "nope-10",
    "nope-11",
    "nope-12",
    "yup-01",
    "yup-02",
    "yup-03",
    "yup-04",
    "yup-05",
    "yup-06",
)

/** Every ID selectable in [ai.kilocode.client.attention.NotificationSoundDialog], in list order. */
internal val AttentionSoundIDs = listOf(AttentionSoundSettings.OFF, "default", "system") + CustomSoundIDs

/** "bip-bop-03" -> "Bip-Bop 03"; "alert-01" -> "Alert 01". */
internal fun attentionSoundLabel(id: String): String = when (id) {
    AttentionSoundSettings.OFF -> KiloBundle.message("attention.sound.off")
    "default" -> KiloBundle.message("attention.sound.default")
    "system" -> KiloBundle.message("attention.sound.system")
    else -> {
        val parts = id.split("-").toMutableList()
        val num = parts.removeAt(parts.size - 1)
        val name = parts.joinToString("-") { it.replaceFirstChar(Char::uppercase) }
        "$name $num"
    }
}
