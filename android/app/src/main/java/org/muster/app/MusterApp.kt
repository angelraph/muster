package org.muster.app

import android.app.Application
import com.google.firebase.FirebaseApp

class MusterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.HAS_FIREBASE) {
            FirebaseApp.initializeApp(this)
            // App Check is required by Firebase AI Logic: debug provider in debug builds, Play Integrity in release.
            AppCheckSetup.install()
        }
    }
}
