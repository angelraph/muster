package org.muster.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Test

/** The same /shared/rule-test-vectors.json the TypeScript engine passes. */
class SharedVectorsTest {
    private val json = Json { ignoreUnknownKeys = true }
    private fun res(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    @Test
    fun kotlinEngineMatchesSharedVectors() {
        val rb = json.decodeFromString(Rulebook.serializer(), res("rulebook.example.json"))
        val vectors = json.parseToJsonElement(res("rule-test-vectors.json")).jsonObject
        val at = vectors["reportedAt"]!!.jsonPrimitive.long
        val base = vectors["base"]!!.jsonObject
        val h = 3_600_000.0
        val cases = vectors["cases"]!!.jsonArray
        for (c in cases) {
            val case = c.jsonObject
            val name = case["name"]!!.jsonPrimitive.content
            val merged = JsonObject(base + case["household"]!!.jsonObject)
            val x = json.decodeFromJsonElement(Extraction.serializer(), merged)
            val now = at + (case["nowH"]!!.jsonPrimitive.double * h).toLong()
            val a = assess(x, case["incidentType"]!!.jsonPrimitive.content, rb, at, now)
            val e = case["expect"]!!.jsonObject

            assertEquals(name, e["priority"]!!.jsonPrimitive.content, a.priority.name)
            val dh: JsonElement = e["deadlineH"]!!
            assertEquals(name, if (dh is JsonNull) null else dh.jsonPrimitive.double, a.deadline?.let { (it - at) / h })
            assertEquals(name, e["overdue"]!!.jsonPrimitive.boolean, a.overdue)
            assertEquals(name, e["nextCheckH"]!!.jsonPrimitive.double, (a.nextCheckBy - at) / h, 1e-9)
            assertEquals(name, e["hazards"]!!.jsonArray.map { it.jsonPrimitive.content }, a.hazards.map { it.code })
        }
        println("Kotlin engine passed ${cases.size} shared vectors")
    }
}
