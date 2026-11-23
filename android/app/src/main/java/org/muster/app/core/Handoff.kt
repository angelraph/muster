package org.muster.app.core

import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.Deflater
import java.util.zip.Inflater

/**
 * Phone-to-phone handoff with no network. Same frame format as web/src/core/handoff.ts:
 * "MU1|<batch>|<i>/<n>|<base64url(deflate-raw(json))>" so Android and web can hand records to each other.
 * Payload is the flat household list (same JSON as the web app).
 */
object HandoffCodec {
    const val FRAME_CHARS = 900
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun encode(flatJson: String): List<String> {
        val d = Deflater(Deflater.BEST_COMPRESSION, true).apply { setInput(flatJson.toByteArray()); finish() }
        val out = ByteArrayOutputStream(); val buf = ByteArray(4096)
        while (!d.finished()) out.write(buf, 0, d.deflate(buf))
        val data = Base64.getUrlEncoder().withoutPadding().encodeToString(out.toByteArray())
        val batch = (1..4).map { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
        val n = maxOf(1, (data.length + FRAME_CHARS - 1) / FRAME_CHARS)
        return (0 until n).map { i -> "MU1|$batch|${i + 1}/$n|${data.substring(i * FRAME_CHARS, minOf(data.length, (i + 1) * FRAME_CHARS))}" }
    }

    class Collector {
        private var batch = ""
        private val parts = HashMap<Int, String>()
        var total = 0; private set
        val received get() = parts.size
        val complete get() = total > 0 && parts.size == total

        fun add(frame: String): Boolean {
            val m = Regex("^MU1\\|(\\w+)\\|(\\d+)/(\\d+)\\|(.*)$", RegexOption.DOT_MATCHES_ALL).find(frame) ?: return false
            val (b, i, n, data) = m.destructured
            if (b != batch) { batch = b; parts.clear(); total = n.toInt() }
            return parts.put(i.toInt(), data) == null
        }

        fun json(): String {
            val data = (1..total).joinToString("") { parts[it] ?: "" }
            val bytes = Base64.getUrlDecoder().decode(data)
            val inf = Inflater(true).apply { setInput(bytes) }
            val out = ByteArrayOutputStream(); val buf = ByteArray(4096)
            while (!inf.finished()) { val k = inf.inflate(buf); if (k == 0 && (inf.needsInput() || inf.needsDictionary())) break; out.write(buf, 0, k) }
            return out.toString(Charsets.UTF_8.name())
        }
    }

    fun listJson(list: List<Household>): String = json.encodeToString(ListSerializer(Household.serializer()), list)
}
