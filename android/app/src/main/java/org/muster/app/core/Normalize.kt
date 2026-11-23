package org.muster.app.core

// Model output is untrusted. Anything outside the schema becomes "unknown", never a guess. Mirrors web normalize.ts.
private val TRI = setOf("yes", "no", "unknown")
private val POWER = setOf("ok", "none", "unknown")

private fun tri(v: String) = if (v in TRI) v else "unknown"
private fun count(v: Int) = if (v in 0..30) v else -1
private fun amount(v: Double, max: Double) = if (v.isFinite() && v >= 0 && v <= max) Math.round(v * 100) / 100.0 else -1.0

fun normalize(r: Extraction): Extraction = Extraction(
    descriptor = r.descriptor.take(60).trim(),
    adults = count(r.adults), over65 = count(r.over65), children = count(r.children), infantsUnder1 = count(r.infantsUnder1),
    livesAlone = tri(r.livesAlone),
    deviceType = if (r.deviceType in DEVICES) r.deviceType else "unknown",
    devicePower = if (r.devicePower in POWER) r.devicePower else "unknown",
    deviceBatteryHours = amount(r.deviceBatteryHours, 168.0),
    dialysis = tri(r.dialysis), dialysisLastSessionHoursAgo = amount(r.dialysisLastSessionHoursAgo, 720.0),
    insulin = tri(r.insulin), insulinRefrigerated = tri(r.insulinRefrigerated), insulinSupplyDays = amount(r.insulinSupplyDays, 365.0),
    hasCooling = tri(r.hasCooling), mobilityLimited = tri(r.mobilityLimited),
    waterDaysLeft = amount(r.waterDaysLeft, 60.0), infantFormulaDaysLeft = amount(r.infantFormulaDaysLeft, 60.0),
    needs = r.needs.filter { it in NEEDS }.distinct(),
)

/** Fields to ask about before leaving the door. */
fun askKeys(v: Extraction): Set<String> = buildSet {
    if (v.deviceType != "none" && v.deviceType != "unknown") {
        if (v.devicePower == "unknown") add("devicePower")
        if (v.devicePower == "none" && v.deviceBatteryHours < 0) add("deviceBatteryHours")
    }
    if (v.dialysis == "yes" && v.dialysisLastSessionHoursAgo < 0) add("dialysisLastSessionHoursAgo")
    if (v.insulin == "yes" && v.insulinRefrigerated == "unknown") add("insulinRefrigerated")
    if (v.over65 > 0) { if (v.livesAlone == "unknown") add("livesAlone"); if (v.hasCooling == "unknown") add("hasCooling") }
    if (v.infantsUnder1 > 0 && v.infantFormulaDaysLeft < 0) add("infantFormulaDaysLeft")
}

data class Building(val id: String, val zone: String, val label: String)

/** Same synthetic neighbourhood as the web app (web/src/core/seed.ts). */
fun demoBuildings(): List<Building> {
    val streets = listOf("River Rd", "Mill St", "Church Ln", "Market St", "Hill Ave", "Bridge St")
    return streets.flatMapIndexed { row, street ->
        (0 until 10).map { i ->
            val n = (i + 1) * 2 + (row % 2)
            Building("B$row${i.toString().padStart(2, '0')}", "Z${row * 2 + i / 5 + 1}", "$n $street")
        }
    }
}
