plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// Firebase config is per-developer and not committed. Without it the app runs in local demo mode.
val hasGoogleServices = file("google-services.json").exists()
if (hasGoogleServices) apply(plugin = "com.google.gms.google-services")

android {
    namespace = "org.muster.app"
    compileSdk {
        version = release(37) { minorApiLevel = 1 }
    }

    defaultConfig {
        applicationId = "org.muster.app"
        minSdk = 26 // firebase-ai-ondevice
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("boolean", "HAS_FIREBASE", hasGoogleServices.toString())
        buildConfigField("String", "INCIDENT_ID", "\"demo-riverside\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug-signed so judges can sideload the APK from the GitHub release.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    // Shared rule test vectors live outside the Android project: /shared
    sourceSets["test"].resources.directories.add("../../shared")
    sourceSets["main"].assets.directories.add("../../shared")
}

dependencies {
    // Firebase AI Logic + hybrid on-device (ondevice is not in the BoM yet)
    implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
    implementation("com.google.firebase:firebase-ai:18.2.0")
    implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta08")
    ksp("com.google.firebase:firebase-ai-ksp-processor:17.0.0")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-config")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    debugImplementation("com.google.firebase:firebase-appcheck-debug")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.13.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    implementation(platform("androidx.compose:compose-bom:2026.11.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")

    // QR handoff with no network
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    testImplementation("junit:junit:4.13.2")
}
