package org.muster.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.muster.app.core.Extraction

private val TRI = listOf("yes" to "Yes", "no" to "No", "unknown" to "?")
private val DEVICES = listOf("none" to "None", "oxygen_concentrator" to "Oxygen", "ventilator" to "Ventilator", "cpap" to "CPAP",
    "suction" to "Suction", "other_powered_medical" to "Other", "unknown" to "?")
private val NEEDS = listOf("water" to "Water", "food" to "Food", "medication" to "Medicine", "medical_transport" to "Medical transport",
    "evacuation" to "Evacuation", "shelter" to "Shelter", "power" to "Power", "baby_supplies" to "Baby supplies",
    "mobility_help" to "Mobility help", "sanitation" to "Sanitation")

/** The tap form: works on every phone. Field order follows the incident template from Remote Config. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IntakeForm(v: Extraction, incident: String, highlight: Set<String>, onChange: (Extraction) -> Unit) {
    val heat = incident == "heat_wave"
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(v.descriptor, { onChange(v.copy(descriptor = it.take(60))) }, Modifier.fillMaxWidth(),
            label = { Text("Where is the door? (no names)") }, singleLine = true)

        if (heat) HeatBlock(v, highlight, onChange)
        Field("Powered medical device", "deviceType" in highlight) {
            Chips(DEVICES, v.deviceType) { onChange(v.copy(deviceType = it)) }
        }
        if (v.deviceType != "none" && v.deviceType != "unknown") {
            Field("Device has power?", "devicePower" in highlight) {
                Chips(listOf("ok" to "Yes", "none" to "No", "unknown" to "?"), v.devicePower) { onChange(v.copy(devicePower = it)) }
            }
            if (v.devicePower != "ok") Field("Battery / backup left (hours)", "deviceBatteryHours" in highlight) {
                Stepper(v.deviceBatteryHours, 1.0) { onChange(v.copy(deviceBatteryHours = it)) }
            }
        }
        Field("On dialysis?", false) { Chips(TRI, v.dialysis) { onChange(v.copy(dialysis = it)) } }
        if (v.dialysis == "yes") Field("Last dialysis (hours ago)", "dialysisLastSessionHoursAgo" in highlight) {
            Stepper(v.dialysisLastSessionHoursAgo, 1.0) { onChange(v.copy(dialysisLastSessionHoursAgo = it)) }
        }
        Field("Uses insulin?", false) { Chips(TRI, v.insulin) { onChange(v.copy(insulin = it)) } }
        if (v.insulin == "yes") {
            Field("Insulin kept cold?", "insulinRefrigerated" in highlight) { Chips(TRI, v.insulinRefrigerated) { onChange(v.copy(insulinRefrigerated = it)) } }
            Field("Insulin supply (days)", false) { Stepper(v.insulinSupplyDays, 0.5) { onChange(v.copy(insulinSupplyDays = it)) } }
        }
        Field("Adults (18-64)", false) { Stepper(v.adults.toDouble(), 1.0) { onChange(v.copy(adults = it.toInt())) } }
        if (!heat) Field("Aged 65+", false) { Stepper(v.over65.toDouble(), 1.0) { onChange(v.copy(over65 = it.toInt())) } }
        Field("Children (1-17)", false) { Stepper(v.children.toDouble(), 1.0) { onChange(v.copy(children = it.toInt())) } }
        Field("Babies under 1", false) { Stepper(v.infantsUnder1.toDouble(), 1.0) { onChange(v.copy(infantsUnder1 = it.toInt())) } }
        if (v.infantsUnder1 > 0) Field("Baby formula (days)", "infantFormulaDaysLeft" in highlight) {
            Stepper(v.infantFormulaDaysLeft, 0.5) { onChange(v.copy(infantFormulaDaysLeft = it)) }
        }
        if (!heat) {
            Field("Lives alone?", "livesAlone" in highlight) { Chips(TRI, v.livesAlone) { onChange(v.copy(livesAlone = it)) } }
            Field("Working cooling (AC/fan)?", "hasCooling" in highlight) { Chips(TRI, v.hasCooling) { onChange(v.copy(hasCooling = it)) } }
        }
        Field("Cannot walk out unaided?", false) { Chips(TRI, v.mobilityLimited) { onChange(v.copy(mobilityLimited = it)) } }
        Field("Drinking water (days)", false) { Stepper(v.waterDaysLeft, 0.5) { onChange(v.copy(waterDaysLeft = it)) } }
        Field("Needs", false) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                NEEDS.forEach { (k, l) ->
                    FilterChip(k in v.needs, { onChange(v.copy(needs = if (k in v.needs) v.needs - k else v.needs + k)) }, { Text(l) })
                }
            }
        }
    }
}

@Composable
private fun HeatBlock(v: Extraction, highlight: Set<String>, onChange: (Extraction) -> Unit) {
    Field("Aged 65+", false) { Stepper(v.over65.toDouble(), 1.0) { onChange(v.copy(over65 = it.toInt())) } }
    Field("Lives alone?", "livesAlone" in highlight) { Chips(TRI, v.livesAlone) { onChange(v.copy(livesAlone = it)) } }
    Field("Working cooling (AC/fan)?", "hasCooling" in highlight) { Chips(TRI, v.hasCooling) { onChange(v.copy(hasCooling = it)) } }
}

@Composable
fun Field(label: String, hl: Boolean, content: @Composable () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth(), border = BorderStroke(if (hl) 2.dp else 1.dp, if (hl) Color(0xFFFACC15) else Color(0xFF334155))) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, style = MaterialTheme.typography.labelLarge)
            content()
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Chips(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (k, l) -> FilterChip(selected == k, { onSelect(k) }, { Text(l) }) }
    }
}

@Composable
private fun Stepper(value: Double, step: Double, onChange: (Double) -> Unit) {
    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton({ onChange(if (value <= 0) -1.0 else maxOf(0.0, value - step)) }) { Text("−") }
        OutlinedTextField(
            if (value < 0) "" else value.toString().removeSuffix(".0"),
            { t -> onChange(t.toDoubleOrNull()?.takeIf { it >= 0 } ?: -1.0) },
            Modifier.width(110.dp), placeholder = { Text("?") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        )
        OutlinedButton({ onChange((if (value < 0) 0.0 else value) + step) }) { Text("+") }
    }
}
