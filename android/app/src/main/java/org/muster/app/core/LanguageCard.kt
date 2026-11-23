package org.muster.app.core

import android.content.Context
import org.json.JSONObject

/**
 * Resident language card. Same phrases and same answer-to-record rules as the web app
 * (shared/language-card.json, bundled as an asset), so it works with no signal. No AI involved.
 */
object LanguageCard {
    data class Lang(val code: String, val name: String, val english: String, val rtl: Boolean, val card: Map<String, String>, val q: Map<String, String>)
    enum class Kind { COUNT, YESNO, DAYS, WHEN }
    data class Q(val id: String, val kind: Kind, val askIf: (Map<String, Any>) -> Boolean = { true })

    val FLOW = listOf(
        Q("people", Kind.COUNT), Q("over65", Kind.YESNO), Q("baby", Kind.YESNO), Q("device", Kind.YESNO), Q("power", Kind.YESNO),
        Q("dialysis", Kind.YESNO), Q("dialysisWhen", Kind.WHEN) { it["dialysis"] == "yes" },
        Q("insulin", Kind.YESNO), Q("insulinCold", Kind.YESNO) { it["insulin"] == "yes" },
        Q("water", Kind.DAYS), Q("leave", Kind.YESNO),
    )
    val WHEN_HOURS = doubleArrayOf(6.0, 24.0, 48.0, 72.0)

    @Volatile private var cache: List<Lang>? = null
    var review: String = ""; private set

    fun langs(ctx: Context): List<Lang> = cache ?: run {
        val root = JSONObject(ctx.assets.open("language-card.json").bufferedReader().use { it.readText() })
        review = root.optString("review")
        val arr = root.getJSONArray("languages")
        (0 until arr.length()).map { i ->
            val l = arr.getJSONObject(i); val c = l.getJSONObject("card"); val q = c.getJSONObject("q")
            Lang(l.getString("code"), l.getString("name"), l.getString("english"), l.getString("dir") == "rtl",
                c.keys().asSequence().filter { it != "q" }.associateWith { c.getString(it) },
                q.keys().asSequence().associateWith { q.getString(it) })
        }.also { cache = it }
    }

    fun next(a: Map<String, Any>): Q? = FLOW.firstOrNull { it.id !in a && it.askIf(a) }

    private fun tri(v: Any?) = when (v) { "yes" -> "yes"; "no" -> "no"; else -> "unknown" }
    private fun atLeastOne(v: Any?) = when (v) { "yes" -> 1; "no" -> 0; else -> -1 }

    /** Merge the resident's answers into the volunteer's draft. Only answered questions change anything. */
    fun apply(d0: Extraction, a: Map<String, Any>): Extraction {
        var d = d0
        val needs = d.needs.toMutableList()
        fun need(n: String) { if (n !in needs) needs += n }
        (a["people"] as? Int)?.let { d = d.copy(adults = it, livesAlone = if (it == 1) "yes" else "no") }
        if ("over65" in a) d = d.copy(over65 = atLeastOne(a["over65"]))
        if ("baby" in a) d = d.copy(infantsUnder1 = atLeastOne(a["baby"]))
        when (a["device"]) {
            "yes" -> if (d.deviceType == "none" || d.deviceType == "unknown") d = d.copy(deviceType = "other_powered_medical")
            "no" -> d = d.copy(deviceType = "none")
            "unsure" -> d = d.copy(deviceType = "unknown")
        }
        if ("power" in a) d = d.copy(devicePower = when (a["power"]) { "yes" -> "ok"; "no" -> "none"; else -> "unknown" })
        if (a["power"] == "no" && a["device"] == "yes") need("power")
        if ("dialysis" in a) d = d.copy(dialysis = tri(a["dialysis"]))
        (a["dialysisWhen"] as? Int)?.let { d = d.copy(dialysisLastSessionHoursAgo = WHEN_HOURS.getOrElse(it) { -1.0 }) }
        if ("insulin" in a) d = d.copy(insulin = tri(a["insulin"]))
        if ("insulinCold" in a) d = d.copy(insulinRefrigerated = tri(a["insulinCold"]))
        (a["water"] as? Int)?.let { d = d.copy(waterDaysLeft = it.toDouble()); if (it < 1) need("water") }
        if ("leave" in a) { d = d.copy(mobilityLimited = tri(a["leave"])); if (a["leave"] == "yes") need("evacuation") }
        return d.copy(needs = needs)
    }
}
