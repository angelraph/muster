package org.muster.app.core

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Same cases as web/src/core/language.test.ts: taps from the language card must reach the same priority. */
class LanguageCardTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val rb = json.decodeFromString(Rulebook.serializer(), javaClass.classLoader!!.getResource("rulebook.example.json")!!.readText())

    @Test
    fun deviceWithoutPowerIsUrgent() {
        val x = LanguageCard.apply(Extraction(), mapOf("people" to 1, "over65" to "yes", "baby" to "no", "device" to "yes", "power" to "no",
            "dialysis" to "no", "insulin" to "no", "water" to 0, "leave" to "yes"))
        assertEquals("other_powered_medical", x.deviceType)
        assertEquals("none", x.devicePower)
        assertTrue(x.needs.containsAll(listOf("power", "water", "evacuation")))
        assertEquals(Priority.P1, assess(x, "flood", rb, 0, 0).priority)
    }

    @Test
    fun notSureStaysUnknownAndUrgent() {
        val x = LanguageCard.apply(Extraction(), mapOf("device" to "yes", "power" to "unsure"))
        assertEquals("unknown", x.devicePower)
        assertEquals(Priority.P1, assess(x, "flood", rb, 0, 0).priority)
    }
}
