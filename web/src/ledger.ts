// Inference Ledger: every AI call this device makes, where it ran, how long it took, what left the device and why.
// Stored on this device only. It proves the hybrid claims instead of asserting them.
export type Task = 'extract' | 'summary' | 'runsheet' | 'translate' | 'ics214' | 'eval';
export type Mode = 'ONLY_ON_DEVICE' | 'PREFER_ON_DEVICE' | 'ONLY_IN_CLOUD';

export interface LedgerEntry {
  id: string;
  at: number;
  task: Task;
  mode: Mode;
  source: 'on_device' | 'in_cloud' | 'refused' | 'error';
  ms: number;
  /** Bytes of request text that left this device for the cloud. 0 when the call ran on the device. */
  bytesUp: number;
  /** True when the input was doorstep data (a note or a photo). */
  doorstep: boolean;
  reason: string;
  online: boolean;
}

const KEY = 'muster.ledger.v1';
const MAX = 400;
const listeners = new Set<(l: LedgerEntry[]) => void>();
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('muster-ledger') : null;

export function readLedger(): LedgerEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function logCall(e: Omit<LedgerEntry, 'id' | 'at' | 'online'>): LedgerEntry {
  const entry: LedgerEntry = { ...e, id: crypto.randomUUID().slice(0, 8), at: Date.now(), online: navigator.onLine };
  const list = [entry, ...readLedger()].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full: keep going */ }
  listeners.forEach((l) => l(list));
  chan?.postMessage('changed');
  return entry;
}

export function clearLedger() {
  localStorage.removeItem(KEY);
  listeners.forEach((l) => l([]));
  chan?.postMessage('changed');
}

export function subscribeLedger(cb: (l: LedgerEntry[]) => void): () => void {
  listeners.add(cb);
  const on = () => cb(readLedger());
  chan?.addEventListener('message', on);
  cb(readLedger());
  return () => { listeners.delete(cb); chan?.removeEventListener('message', on); };
}

export const byteLength = (s: string) => new TextEncoder().encode(s).length;

export interface LedgerStats { total: number; onDevice: number; cloud: number; refused: number; doorstepBytesUp: number; cloudBytesUp: number; avgDeviceMs: number; avgCloudMs: number }

export function stats(list: LedgerEntry[]): LedgerStats {
  const dev = list.filter((e) => e.source === 'on_device');
  const cl = list.filter((e) => e.source === 'in_cloud');
  const avg = (xs: LedgerEntry[]) => (xs.length ? Math.round(xs.reduce((s, e) => s + e.ms, 0) / xs.length) : 0);
  return {
    total: list.length,
    onDevice: dev.length,
    cloud: cl.length,
    refused: list.filter((e) => e.source === 'refused').length,
    doorstepBytesUp: list.filter((e) => e.doorstep).reduce((s, e) => s + e.bytesUp, 0),
    cloudBytesUp: cl.reduce((s, e) => s + e.bytesUp, 0),
    avgDeviceMs: avg(dev),
    avgCloudMs: avg(cl),
  };
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
