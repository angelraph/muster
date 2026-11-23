package org.muster.app.core

import com.google.firebase.ai.annotations.Generable
import com.google.firebase.ai.annotations.Guide
import kotlinx.serialization.Serializable

/**
 * What a volunteer confirms at the door. Same shape as /shared/extraction.schema.json.
 * There is no name field, by design. Unknown numbers are -1, unknown facts are "unknown".
 * @Generable lets the KSP processor build the on-device JSON schema for generateObject().
 */
@Serializable
@Generable("A disaster needs-intake record for one household. Never contains a person's name.")
data class Extraction(
    @Guide(description = "Short way to find the door, e.g. 'blue door, 2nd floor'. Never a name.")
    val descriptor: String = "",
    @Guide(description = "Adults aged 18-64 present, -1 if unknown") val adults: Int = -1,
    @Guide(description = "People aged 65 or older, -1 if unknown") val over65: Int = -1,
    @Guide(description = "Children aged 1-17, -1 if unknown") val children: Int = -1,
    @Guide(description = "Babies under 1 year, -1 if unknown") val infantsUnder1: Int = -1,
    @Guide(enumValues = ["yes", "no", "unknown"]) val livesAlone: String = "unknown",
    @Guide(enumValues = ["none", "oxygen_concentrator", "ventilator", "cpap", "suction", "other_powered_medical", "unknown"])
    val deviceType: String = "none",
    @Guide(description = "Does the powered medical device have mains power now", enumValues = ["ok", "none", "unknown"])
    val devicePower: String = "unknown",
    @Guide(description = "Hours of battery or backup power left, -1 if unknown") val deviceBatteryHours: Double = -1.0,
    @Guide(enumValues = ["yes", "no", "unknown"]) val dialysis: String = "unknown",
    @Guide(description = "Hours since the last dialysis session, -1 if unknown") val dialysisLastSessionHoursAgo: Double = -1.0,
    @Guide(enumValues = ["yes", "no", "unknown"]) val insulin: String = "unknown",
    @Guide(enumValues = ["yes", "no", "unknown"]) val insulinRefrigerated: String = "unknown",
    @Guide(description = "Days of insulin left, -1 if unknown") val insulinSupplyDays: Double = -1.0,
    @Guide(description = "Working air conditioning or fan", enumValues = ["yes", "no", "unknown"]) val hasCooling: String = "unknown",
    @Guide(description = "Cannot walk out unaided", enumValues = ["yes", "no", "unknown"]) val mobilityLimited: String = "unknown",
    @Guide(description = "Days of drinking water left, -1 if unknown") val waterDaysLeft: Double = -1.0,
    @Guide(description = "Days of baby formula left, -1 if unknown") val infantFormulaDaysLeft: Double = -1.0,
    @Guide(description = "Needs mentioned in the note")
    val needs: List<String> = emptyList(),
) {
    companion object
}

/** The record that syncs to Firestore (field names match the web app and the Firestore rules). */
@Serializable
data class Household(
    val id: String,
    val incidentId: String,
    val buildingId: String?,
    val reportedAt: Long,
    val reportedBy: String,
    val source: String, // "on_device" | "tap"
    val rulebookVersion: String,
    val visits: Int,
    val x: Extraction,
)

@Serializable
data class Rulebook(
    val version: String,
    val label: String = "",
    val priority: PriorityCfg,
    val recheckHours: RecheckCfg,
    val unknownCriticalRecheckHours: Double,
    val poweredDevice: PoweredCfg,
    val dialysis: DialysisCfg,
    val insulin: InsulinCfg,
    val heat: HeatCfg,
    val supplies: SuppliesCfg,
) {
    @Serializable data class PriorityCfg(val p1WithinHours: Double, val p2WithinHours: Double)
    @Serializable data class RecheckCfg(val P1: Double, val P2: Double, val P3: Double)
    @Serializable data class PoweredCfg(val assumedBatteryHoursWhenUnknown: Double, val safetyMarginHours: Double)
    @Serializable data class DialysisCfg(val maxHoursBetweenSessions: Double)
    @Serializable data class InsulinCfg(val unrefrigeratedDays: Double, val unrefrigeratedDaysInHeat: Double)
    @Serializable data class HeatCfg(val incidentTypes: List<String>, val minAgeBand: String = "over65", val recheckHours: Double)
    @Serializable data class SuppliesCfg(val warnBelowDays: Double)
}

enum class Priority { P1, P2, P3 }

data class Hazard(val code: String, val deadline: Long?, val unknown: Boolean, val label: String, val ask: String? = null)

data class Assessment(val priority: Priority, val deadline: Long?, val overdue: Boolean, val nextCheckBy: Long, val hazards: List<Hazard>)

val NEEDS = listOf("water", "food", "shelter", "power", "medication", "medical_transport", "evacuation", "baby_supplies", "mobility_help", "sanitation")
val DEVICES = listOf("none", "oxygen_concentrator", "ventilator", "cpap", "suction", "other_powered_medical", "unknown")
