// Phone-to-phone handoff with no network: records are deflated, base64url'd and split into
// numbered QR frames ("MU1|<batch>|<i>/<n>|<data>"). The receiving phone scans until it has every frame.
import type { Household } from './types';

const PREFIX = 'MU1';
export const FRAME_CHARS = 900;

async function deflate(text: string): Promise<Uint8Array> {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(bytes: Uint8Array): Promise<string> {
  const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(s).text();
}
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function encodeFrames(households: Household[]): Promise<string[]> {
  const data = toB64(await deflate(JSON.stringify(households)));
  const batch = Math.random().toString(36).slice(2, 6);
  const n = Math.max(1, Math.ceil(data.length / FRAME_CHARS));
  return Array.from({ length: n }, (_, i) => `${PREFIX}|${batch}|${i + 1}/${n}|${data.slice(i * FRAME_CHARS, (i + 1) * FRAME_CHARS)}`);
}

export class FrameCollector {
  private batch = '';
  private parts = new Map<number, string>();
  total = 0;

  /** Returns true when the frame was new. */
  add(frame: string): boolean {
    const m = /^MU1\|(\w+)\|(\d+)\/(\d+)\|(.*)$/s.exec(frame);
    if (!m) return false;
    const [, batch, i, n, data] = m;
    if (batch !== this.batch) { this.batch = batch; this.parts.clear(); this.total = Number(n); }
    if (this.parts.has(Number(i))) return false;
    this.parts.set(Number(i), data);
    return true;
  }
  get received() { return this.parts.size; }
  get complete() { return this.total > 0 && this.parts.size === this.total; }

  async households(): Promise<Household[]> {
    const data = Array.from({ length: this.total }, (_, i) => this.parts.get(i + 1) ?? '').join('');
    const parsed = JSON.parse(await inflate(fromB64(data)));
    return Array.isArray(parsed) ? (parsed as Household[]) : [];
  }
}
