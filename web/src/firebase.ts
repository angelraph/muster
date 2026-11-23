import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from 'firebase/remote-config';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import rulebookDefault from '../../shared/rulebook.example.json';
import type { IncidentType, Rulebook } from './core/types';

export interface Fb { app: FirebaseApp; db: Firestore; ai: AI; rc: RemoteConfig; uid: Promise<string> }

function readConfig(): Record<string, string> | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { console.error('VITE_FIREBASE_CONFIG is not valid JSON'); return null; }
}

let fb: Fb | null | undefined;

/** Returns null in local demo mode (no Firebase config yet). */
export function firebase(): Fb | null {
  if (fb !== undefined) return fb;
  const config = readConfig();
  if (!config) return (fb = null);

  const app = initializeApp(config);

  // App Check is required by Firebase AI Logic. Debug token locally, reCAPTCHA Enterprise when hosted.
  const debug = import.meta.env.DEV || import.meta.env.VITE_APPCHECK_DEBUG === 'true';
  if (debug) {
    // The SDK then uses the debug provider and prints a token to register in Firebase console → App Check.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined) || true;
  }
  const siteKey = (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY as string | undefined) || (debug ? 'debug-only' : '');
  if (siteKey) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });

  // Offline-first: writes at the doorstep queue locally and sync when any signal returns.
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

  const auth = getAuth(app);
  const uid = new Promise<string>((resolve) => {
    onAuthStateChanged(auth, (u) => { if (u) resolve(u.uid); });
    signInAnonymously(auth).catch((e) => console.warn('Anonymous sign-in deferred (offline?)', e));
  });

  const rc = getRemoteConfig(app);
  rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 10_000 : 60_000;
  rc.defaultConfig = {
    incident_type: 'flood',
    rulebook_json: JSON.stringify(rulebookDefault),
    cloud_enabled: true,
    cloud_model: 'gemini-3.5-flash-lite',
  };

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return (fb = { app, db, ai, rc, uid });
}

export interface LiveConfig { incidentType: IncidentType; rulebook: Rulebook; cloudEnabled: boolean; cloudModel: string }

/** Remote Config: the coordinator's operational switches. Falls back to cached/default values offline. */
export async function loadLiveConfig(): Promise<LiveConfig> {
  const f = firebase();
  if (!f) return localConfig();
  try { await fetchAndActivate(f.rc); } catch { /* offline: use last activated values */ }
  let rulebook = rulebookDefault as Rulebook;
  try { rulebook = JSON.parse(getValue(f.rc, 'rulebook_json').asString()); } catch { /* keep default */ }
  return {
    incidentType: getValue(f.rc, 'incident_type').asString() as IncidentType,
    rulebook,
    cloudEnabled: getValue(f.rc, 'cloud_enabled').asBoolean(),
    cloudModel: getValue(f.rc, 'cloud_model').asString(),
  };
}

// Local demo mode stands in for Remote Config so the switches can be rehearsed without a project.
const LOCAL_KEY = 'muster.localConfig';
export function localConfig(): LiveConfig {
  const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
  return { incidentType: 'flood', rulebook: rulebookDefault as Rulebook, cloudEnabled: true, cloudModel: 'gemini-3.5-flash-lite', ...saved };
}
export function setLocalConfig(patch: Partial<LiveConfig>) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}'), ...patch }));
  new BroadcastChannel('muster').postMessage({ type: 'config' });
}
