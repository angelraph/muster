package org.muster.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HandoffTest {
    @Test
    fun roundTripsThroughShuffledRepeatedFrames() {
        // Real records have random UUIDs, which do not compress away.
        val payload = (1..60).joinToString(",", "[", "]") { """{"id":"${java.util.UUID.randomUUID()}","reportedBy":"${java.util.UUID.randomUUID()}","over65":${it % 2},"needs":["water","food"]}""" }
        val frames = HandoffCodec.encode(payload)
        assertTrue(frames.size > 1)
        val c = HandoffCodec.Collector()
        (frames.reversed() + frames).forEach { c.add(it) }
        assertTrue(c.complete)
        assertEquals(payload, c.json())
    }

    @Test
    fun ignoresOtherQrCodes() = assertFalse(HandoffCodec.Collector().add("https://example.com"))
}
