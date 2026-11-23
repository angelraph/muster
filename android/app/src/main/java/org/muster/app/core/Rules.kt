package org.muster.app.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong

// Time-to-harm rules engine. Pure code: the AI never decides who is helped first.
// Line-for-line port of web/src/core/rules.ts; both must pass /shared/rule-test-vectors.json.

private const val H = 3_600_000L
private fun known(n: Double) = n >= 0
private fun hrs(h: Double): Long = (h * H).roundToLong()

private val DEVICE_LABEL = mapOf(
    "oxygen_concentrator" to "Oxygen concentrator", "ventilator" to "Ventilator", "cpap" to "CPAP",
    "suction" to "Suction machine", "other_powered_medical" to "Powered medical device",
)

fun hazardsFor(h: Extraction, incident: String, rb: Rulebook, at: Long): List<Hazard> {
    val out = mutableListOf<Hazard>()

    if (h.deviceType != "none" && h.deviceType != "unknown") {
        val name = DEVICE_LABEL[h.deviceType] ?: "Powered device"
        when (h.devicePower) {
            "none" -> {
                val hours = if (known(h.deviceBatteryHours)) h.deviceBatteryHours else rb.poweredDevice.assumedBatteryHoursWhenUnknown
                val left = max(0.0, hours - rb.poweredDevice.safetyMarginHours)
                out += Hazard("powered_device", at + hrs(left), false, "$name without power",
                    if (known(h.deviceBatteryHours)) null else "How many hours of battery are left?")
            }
            "unknown" -> out += Hazard("powered_device_unknown", null, true, "$name: power status unknown", "Does the device have power right now?")
        }
    }

    if (h.dialysis == "yes") {
        out += if (known(h.dialysisLastSessionHoursAgo)) {
            Hazard("dialysis", at + hrs(rb.dialysis.maxHoursBetweenSessions - h.dialysisLastSessionHoursAgo), false, "Dialysis session due")
        } else {
            Hazard("dialysis_unknown", null, true, "On dialysis: last session unknown", "When was the last dialysis session?")
        }
    }

    if (h.insulin == "yes") {
        val candidates = mutableListOf<Double>()
        if (h.insulinRefrigerated == "no") {
            val days = if (incident in rb.heat.incidentTypes) rb.insulin.unrefrigeratedDaysInHeat else rb.insulin.unrefrigeratedDays
            candidates += days * 24
        }
        if (known(h.insulinSupplyDays)) candidates += h.insulinSupplyDays * 24
        if (candidates.isNotEmpty()) {
            out += Hazard("insulin", at + hrs(candidates.min()), false,
                if (h.insulinRefrigerated == "no") "Insulin without refrigeration" else "Insulin supply running out")
        }
    }

    if (incident in rb.heat.incidentTypes && h.over65 > 0 && h.hasCooling != "yes") {
        if (h.livesAlone == "yes" && h.hasCooling == "no") {
            out += Hazard("heat_isolated", null, false, "Over 65, alone, no cooling")
        } else if (h.livesAlone == "unknown" || h.hasCooling == "unknown") {
            out += Hazard("heat_unknown", null, true, "Over 65 in a heat wave: situation unclear",
                if (h.livesAlone == "unknown") "Does this person live alone?" else "Is there any working cooling?")
        }
    }

    if (h.infantsUnder1 > 0 && known(h.infantFormulaDaysLeft) && h.infantFormulaDaysLeft < rb.supplies.warnBelowDays) {
        out += Hazard("infant_formula", at + hrs(h.infantFormulaDaysLeft * 24), false, "Baby formula running out")
    }
    if (known(h.waterDaysLeft) && h.waterDaysLeft < rb.supplies.warnBelowDays) {
        out += Hazard("water", at + hrs(h.waterDaysLeft * 24), false, "Drinking water running out")
    }
    if (h.mobilityLimited == "yes" && "evacuation" in h.needs) {
        out += Hazard("assisted_evacuation", null, false, "Needs help to evacuate")
    }
    return out
}

private val CRITICAL_UNKNOWN = setOf("powered_device_unknown", "dialysis_unknown")
private fun worst(a: Priority, b: Priority) = if (a.ordinal <= b.ordinal) a else b

fun assess(h: Extraction, incident: String, rb: Rulebook, reportedAt: Long, now: Long): Assessment {
    val hazards = hazardsFor(h, incident, rb, reportedAt)
    val deadline = hazards.mapNotNull { it.deadline }.minOrNull()

    var priority = Priority.P3
    if (deadline != null) {
        val hoursLeft = (deadline - now).toDouble() / H
        priority = when {
            hoursLeft <= rb.priority.p1WithinHours -> Priority.P1
            hoursLeft <= rb.priority.p2WithinHours -> Priority.P2
            else -> Priority.P3
        }
    }
    val caps = mutableListOf<Long>()
    for (z in hazards) {
        when {
            z.code in CRITICAL_UNKNOWN -> { priority = Priority.P1; caps += reportedAt + hrs(rb.unknownCriticalRecheckHours) }
            z.code == "heat_isolated" -> { priority = worst(priority, Priority.P2); caps += reportedAt + hrs(rb.heat.recheckHours) }
            z.unknown || z.code == "assisted_evacuation" -> priority = worst(priority, Priority.P2)
        }
    }
    val recheck = when (priority) { Priority.P1 -> rb.recheckHours.P1; Priority.P2 -> rb.recheckHours.P2; Priority.P3 -> rb.recheckHours.P3 }
    caps += reportedAt + hrs(recheck)
    if (deadline != null) caps += deadline

    return Assessment(priority, deadline, deadline != null && deadline < now, caps.min(), hazards)
}

/** "2 h 58 m", "overdue 8 h 0 m", "3 d 4 h" */
fun formatLeft(ms: Long): String {
    var m = (abs(ms) / 60_000.0).let { kotlin.math.round(it).toLong() }
    val d = m / 1440; m -= d * 1440
    val h = m / 60; m -= h * 60
    val s = if (d > 0) "$d d $h h" else if (h > 0) "$h h $m m" else "$m m"
    return if (ms < 0) "overdue $s" else s
}

fun priorityText(p: Priority) = when (p) { Priority.P1 -> "Urgent"; Priority.P2 -> "Soon"; Priority.P3 -> "Routine" }
