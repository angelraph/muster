package org.muster.app

import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/** Debug builds print a token in Logcat ("DebugAppCheckProvider"): register it in Firebase console → App Check. */
object AppCheckSetup {
    fun install() = Firebase.appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
}
