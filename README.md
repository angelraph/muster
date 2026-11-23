# Muster

**After a disaster, many deaths come in the days after the storm, not during it.** The oxygen concentrator's battery runs out, insulin goes warm, a dialysis session is missed, and a man over 65 who lives alone is never checked.
Muster finds those households **before their time runs out**, even when every cell tower is down.

- **Hurricane Maria (2017):** about one third of an estimated 4,645 excess deaths were attributed to delayed or interrupted medical care. *(Kishore et al., NEJM 2018)*
- **2021 heat dome, Multnomah County:** 71% of the people who died lived alone, and 94% died at home. *(Multnomah County)*
- **Hurricane Helene (2024):** about 74% of cell sites in the affected North Carolina counties were offline at peak. *(FCC data)*

Built for **#BuildHybridAI 2026** with **Firebase AI Logic hybrid inference** · Web (Chrome) + Android.

---

## What it does

| | |
|---|---|
| **Doorstep intake, offline** | The volunteer speaks or types what they see. Gemini Nano turns it into a fixed record **on the device** (`ONLY_ON_DEVICE`). The volunteer confirms every field. |
| **Label photo, offline** | A photo of an insulin pen or an oxygen-device plate fills fields on-device. The photo never leaves the device. |
| **Time-to-harm clock** | Code computes a deadline for each household from an agency-owned rulebook, for example "oxygen: 2 h 0 m" or "dialysis: overdue". **The AI never decides who gets help first.** |
| **Unknown is never "safe"** | A missing critical fact (does the device have power?) makes the household urgent, with a 2-hour recheck and the exact question to ask. |
| **Homes nobody has checked** | Every known building is on the map. Homes nobody has visited glow, because in a heat wave silence is the alarm. |
| **Recheck queue** | Every urgent household has a "revisit by" time, so nobody falls off the list. |
| **QR handoff** | With no network at all, a volunteer's records hop phone to phone as animated QR codes. Whoever reaches signal first syncs everyone. |
| **No-model devices are first-class** | Cheap phones get a tap form with the same schema, rules and sync. The banner says so honestly. |
| **Coordinator board (Chrome)** | Live clocks, priorities, duplicate merges (decided by code, confirmed by a human), and cloud run sheets per team. |
| **Remote Config is operational** | Switch the incident type (flood → heat wave changes the intake form on every phone), update the rulebook, or kill all cloud AI. |

## How hybrid inference is used

Each mode has a physical reason:

| Moment | Mode | Why |
|---|---|---|
| Doorstep note / photo → record | `ONLY_ON_DEVICE` | No signal at the door, and a stranger's medical situation shouldn't be uploaded. If the model isn't ready, Muster **refuses and opens the tap form**. There is no cloud fallback for doorstep data. |
| One-line household summary (coordinator) | `PREFER_ON_DEVICE` | Works even if the shelter's link drops. The input is the whitelisted cloud-safe record. |
| Run sheets, shift handover, label translation | `ONLY_IN_CLOUD` | Needs **every volunteer's records at once**, which no single device has. |

`response.inferenceSource` is shown on every AI result as "On this device" or "Cloud".

**Voice:** on-device Gemini does not accept audio, so speech is transcribed first. The mic only appears when Chrome can recognise speech **on the device** (`processLocally`); otherwise the volunteer types.

## Privacy by construction (and tested)

- **Schema:** the household schema has **no name field** ([`shared/extraction.schema.json`](shared/extraction.schema.json)).
- **Cloud payloads:** built by **whitelist** ([`web/src/core/payload.ts`](web/src/core/payload.ts)). Door descriptions, transcripts, photos and volunteer IDs cannot be included, and a runtime guard rejects any request containing them.
- **Firestore rules** reject any household document with fields outside the schema, so even a modified client can't store a name or transcript ([`firebase/firestore.rules`](firebase/firestore.rules)).
- **Cloud output is checked:** a stop the cloud adds that code didn't plan is removed and reported. Stop order is computed by code ([`web/src/core/plan.ts`](web/src/core/plan.ts)).
- **Doorstep notes** are kept only on the volunteer's device.

## One rules engine, two platforms

[`shared/rule-test-vectors.json`](shared/rule-test-vectors.json) holds 16 cases. The TypeScript engine and the Kotlin engine must both pass the same file, so phone and laptop always compute the same deadline.

## Firebase products

- **Firebase AI Logic** (hybrid inference)
- **App Check** (reCAPTCHA Enterprise / Play Integrity, with debug tokens for judges)
- **Firestore** (offline persistence, membership rules)
- **Anonymous Auth** + incident join codes
- **Remote Config** (incident template, rulebook, cloud kill switch, cloud model)
- **Hosting**

## Run it

```bash
cd web
npm install
npm test          # rules engine, privacy, merge, planning, QR handoff
npm run dev       # http://localhost:5173 — works in demo mode without Firebase
```

**Demo mode** (no Firebase config): tap mode, a local store synced between browser tabs, and demo switches standing in for Remote Config. Click **Load demo households** on the home page.

**With Firebase:**
1. Copy `web/.env.example` to `web/.env.local` and paste your web `firebaseConfig`.
2. Deploy the rules and the Remote Config template: `firebase deploy --only firestore:rules,remoteconfig`.
3. Create `incidents/demo-riverside` in Firestore with a `joinCode` field.

**Android** (Kotlin + Jetpack Compose, `firebase-ai` + `firebase-ai-ondevice`, KSP `@Generable` schema):
```bash
cd android
./gradlew :app:testDebugUnitTest   # Kotlin engine passes the same shared vectors + QR codec tests
./gradlew :app:assembleDebug       # app/build/outputs/apk/debug/app-debug.apk
```
- Put your `google-services.json` in `android/app/`. Without it, the app runs in local demo mode.
- On phones with Gemini Nano (AICore), doorstep notes and label photos are read with `generateObject` in `ONLY_ON_DEVICE` mode.
- On every other phone, the app says so and uses the tap form. Records still sync and still get time-to-harm clocks.
- Voice uses Android's **on-device** speech recognizer only (`createOnDeviceSpeechRecognizer`).
- QR handoff uses the same frame format as the web app, so phones and laptops can exchange records.

**On-device AI in Chrome:** desktop Chrome 139+. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, relaunch, then press **Install on-device AI** in the app.

**For judges (App Check):** run locally with `VITE_APPCHECK_DEBUG=true`. Register the debug token printed in the console under Firebase console → App Check → Manage debug tokens.

## Not medical advice

Muster does needs intake and logistics. Every threshold comes from the responding agency's rulebook in Remote Config. The values shipped here are clearly labelled examples.

## License

Apache-2.0
