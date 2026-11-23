// Households live in Firestore (offline cache on) or, before Firebase is configured, in a local demo store
// that syncs between browser tabs - so two tabs can rehearse "two volunteers + a coordinator".
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase } from './firebase';
import type { Household } from './core/types';

export const INCIDENT_ID = (import.meta.env.VITE_INCIDENT_ID as string | undefined) ?? 'demo-riverside';

type Listener = (list: Household[]) => void;
const LOCAL_KEY = `muster.households.${INCIDENT_ID}`;
const channel = new BroadcastChannel('muster');

const readLocal = (): Household[] => JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
const localListeners = new Set<Listener>();
function writeLocal(list: Household[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  channel.postMessage({ type: 'households' }); // other tabs
  localListeners.forEach((l) => l(list)); // this tab (BroadcastChannel skips the sender)
}

export function subscribeHouseholds(cb: Listener): () => void {
  const f = firebase();
  if (f) {
    return onSnapshot(collection(f.db, 'incidents', INCIDENT_ID, 'households'), (snap) =>
      cb(snap.docs.map((d) => d.data() as Household)));
  }
  cb(readLocal());
  const onMsg = (e: MessageEvent) => { if (e.data?.type === 'households') cb(readLocal()); };
  channel.addEventListener('message', onMsg);
  localListeners.add(cb);
  return () => { channel.removeEventListener('message', onMsg); localListeners.delete(cb); };
}

/** Saves to this device immediately. `synced` resolves only when the server has acknowledged the write. */
export function saveHousehold(h: Household): { synced: Promise<boolean> } {
  const f = firebase();
  if (f) {
    const synced = setDoc(doc(f.db, 'incidents', INCIDENT_ID, 'households', h.id), h).then(() => true, () => false);
    return { synced };
  }
  writeLocal([...readLocal().filter((x) => x.id !== h.id), h]);
  return { synced: Promise.resolve(true) };
}

export function removeHousehold(id: string): void {
  const f = firebase();
  if (f) { void deleteDoc(doc(f.db, 'incidents', INCIDENT_ID, 'households', id)); return; }
  writeLocal(readLocal().filter((x) => x.id !== id));
}

/** Membership: 'member' | 'coordinator' | 'none'. Cached so it works offline after the first join. */
export async function membership(): Promise<'volunteer' | 'coordinator' | 'none'> {
  const f = firebase();
  if (!f) return 'coordinator';
  const cached = localStorage.getItem(`muster.role.${INCIDENT_ID}`) as 'volunteer' | 'coordinator' | null;
  try {
    const snap = await getDoc(doc(f.db, 'incidents', INCIDENT_ID, 'members', await f.uid));
    const role = snap.exists() ? ((snap.data().role as 'volunteer' | 'coordinator') ?? 'volunteer') : 'none';
    if (role !== 'none') localStorage.setItem(`muster.role.${INCIDENT_ID}`, role);
    return role;
  } catch { return cached ?? 'none'; }
}

export async function joinIncident(code: string): Promise<void> {
  const f = firebase();
  if (!f) return;
  const uid = await f.uid;
  await setDoc(doc(f.db, 'incidents', INCIDENT_ID, 'members', uid), { code: code.trim(), role: 'volunteer', joinedAt: Date.now() });
  localStorage.setItem(`muster.role.${INCIDENT_ID}`, 'volunteer');
}

export async function volunteerId(): Promise<string> {
  const f = firebase();
  if (f) return f.uid;
  let id = sessionStorage.getItem('muster.vid');
  if (!id) { id = 'local-' + crypto.randomUUID().slice(0, 8); sessionStorage.setItem('muster.vid', id); }
  return id;
}

// Doorstep notes and photos never sync. They stay in this browser only.
export function keepPrivateNote(householdId: string, transcript: string) {
  localStorage.setItem(`muster.private.${householdId}`, transcript);
}

export function onConfigChange(cb: () => void): () => void {
  const onMsg = (e: MessageEvent) => { if (e.data?.type === 'config') cb(); };
  channel.addEventListener('message', onMsg);
  return () => channel.removeEventListener('message', onMsg);
}
