package org.muster.app.ai

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * On-device Gemini does not accept audio, so speech is transcribed first.
 * We only use Android's ON-DEVICE recognizer (API 31+). If it is missing, the mic is hidden and the volunteer types:
 * a cloud recognizer would send doorstep audio off the phone.
 */
object Speech {
    fun available(ctx: Context): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)

    fun listen(ctx: Context, onText: (String) -> Unit, onEnd: () -> Unit): () -> Unit {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) { onEnd(); return {} }
        val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
        r.setRecognitionListener(object : RecognitionListener {
            override fun onResults(b: Bundle) { b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let(onText); onEnd() }
            override fun onPartialResults(b: Bundle) { b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let(onText) }
            override fun onError(error: Int) = onEnd()
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, p: Bundle?) {}
        })
        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        })
        return { r.stopListening(); r.destroy() }
    }
}
