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

// ===== Door-hanger attempts and resident self-reports =====
// "No answer" is never treated as safe: the volunteer leaves a door-hanger with a one-time code,
// and the resident can report later from any phone, whenever they get signal.
export interface Attempt { token: string; buildingId: string; at: number; by: string }
export type SelfStatus = 'ok' | 'need';
export interface SelfReport { token: string; buildingId: string; status: SelfStatus; needs: string[]; people: number; at: number }

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
}

function localList<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; } }
function localSubscribe<T>(key: string, cb: (l: T[]) => void): () => void {
  cb(localList<T>(key));
  const onMsg = (e: MessageEvent) => { if (e.data?.type === key) cb(localList<T>(key)); };
  channel.addEventListener('message', onMsg);
  const onStorage = (e: StorageEvent) => { if (e.key === key) cb(localList<T>(key)); };
  addEventListener('storage', onStorage);
  return () => { channel.removeEventListener('message', onMsg); removeEventListener('storage', onStorage); };
}
function localPush<T extends { token: string }>(key: string, item: T) {
  localStorage.setItem(key, JSON.stringify([...localList<T>(key).filter((x) => x.token !== item.token), item]));
  channel.postMessage({ type: key });
}

const ATT_KEY = `muster.attempts.${INCIDENT_ID}`;
const SELF_KEY = `muster.self.${INCIDENT_ID}`;

export async function recordAttempt(buildingId: string): Promise<Attempt> {
  const a: Attempt = { token: newToken(), buildingId, at: Date.now(), by: await volunteerId() };
  const f = firebase();
  if (f) void setDoc(doc(f.db, 'incidents', INCIDENT_ID, 'attempts', a.token), a); // queues offline
  else localPush(ATT_KEY, a);
  return a;
}

export function subscribeAttempts(cb: (l: Attempt[]) => void): () => void {
  const f = firebase();
  if (f) return onSnapshot(collection(f.db, 'incidents', INCIDENT_ID, 'attempts'), (s) => cb(s.docs.map((d) => d.data() as Attempt)), () => cb([]));
  return localSubscribe<Attempt>(ATT_KEY, cb);
}

export function subscribeSelfReports(cb: (l: SelfReport[]) => void): () => void {
  const f = firebase();
  if (f) return onSnapshot(collection(f.db, 'incidents', INCIDENT_ID, 'selfReports'), (s) => cb(s.docs.map((d) => d.data() as SelfReport)), () => cb([]));
  return localSubscribe<SelfReport>(SELF_KEY, cb);
}

/** Resident side. No join code, no account beyond an anonymous session, no free text. */
export async function submitSelfReport(r: Omit<SelfReport, 'buildingId' | 'at'>): Promise<void> {
  const f = firebase();
  if (!f) {
    const att = localList<Attempt>(ATT_KEY).find((a) => a.token === r.token);
    if (!att) throw new Error('That code was not found.');
    localPush(SELF_KEY, { ...r, buildingId: att.buildingId, at: Date.now() });
    return;
  }
  await f.uid;
  const att = await getDoc(doc(f.db, 'incidents', INCIDENT_ID, 'attempts', r.token));
  if (!att.exists()) throw new Error('That code was not found. Check it, or try again once the volunteer phone has synced.');
  const buildingId = att.data().buildingId as string; // rules re-check this against the code
  await setDoc(doc(f.db, 'incidents', INCIDENT_ID, 'selfReports', r.token), { ...r, buildingId, at: Date.now() });
}

// ===== Agency at-risk registry (emPOWER-style) =====
// Parsed in the coordinator's browser. Only building + risk category syncs; the source file never leaves the device.
export interface RegistryEntry { buildingId: string; risks: string[]; importedAt: number }
const REG_KEY = `muster.registry.${INCIDENT_ID}`;

export function subscribeRegistry(cb: (l: RegistryEntry[]) => void): () => void {
  const f = firebase();
  if (f) return onSnapshot(collection(f.db, 'incidents', INCIDENT_ID, 'registry'), (s) => cb(s.docs.map((d) => d.data() as RegistryEntry)), () => cb([]));
  const read = () => { try { return JSON.parse(localStorage.getItem(REG_KEY) ?? '[]') as RegistryEntry[]; } catch { return []; } };
  cb(read());
  const onMsg = (e: MessageEvent) => { if (e.data?.type === REG_KEY) cb(read()); };
  channel.addEventListener('message', onMsg);
  return () => channel.removeEventListener('message', onMsg);
}

export async function saveRegistry(entries: RegistryEntry[]): Promise<void> {
  const f = firebase();
  if (f) { await Promise.all(entries.map((e) => setDoc(doc(f.db, 'incidents', INCIDENT_ID, 'registry', e.buildingId), e))); return; }
  localStorage.setItem(REG_KEY, JSON.stringify(entries));
  channel.postMessage({ type: REG_KEY });
}

export async function clearRegistry(ids: string[]): Promise<void> {
  const f = firebase();
  if (f) { await Promise.all(ids.map((id) => deleteDoc(doc(f.db, 'incidents', INCIDENT_ID, 'registry', id)))); return; }
  localStorage.removeItem(REG_KEY);
  channel.postMessage({ type: REG_KEY });
}
