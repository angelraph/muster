// Voice at the door. On-device Gemini does not accept audio, so speech is transcribed first.
// We only offer the mic when Chrome can recognise speech ON THIS DEVICE (processLocally);
// otherwise the volunteer types. A cloud speech service would send the doorstep audio away.

interface SR extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean; processLocally?: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
}
interface SRStatic {
  new (): SR;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}
const Ctor = (): SRStatic | undefined =>
  (globalThis as unknown as { SpeechRecognition?: SRStatic; webkitSpeechRecognition?: SRStatic }).SpeechRecognition ??
  (globalThis as unknown as { webkitSpeechRecognition?: SRStatic }).webkitSpeechRecognition;

export type SpeechState = 'local' | 'downloadable' | 'unsupported';

export async function localSpeechState(lang = 'en-US'): Promise<SpeechState> {
  const C = Ctor();
  if (!C?.available) return 'unsupported';
  try {
    const s = await C.available({ langs: [lang], processLocally: true });
    return s === 'available' ? 'local' : s === 'downloadable' || s === 'downloading' ? 'downloadable' : 'unsupported';
  } catch { return 'unsupported'; }
}

export async function installLocalSpeech(lang = 'en-US'): Promise<boolean> {
  try { return (await Ctor()?.install?.({ langs: [lang], processLocally: true })) ?? false; } catch { return false; }
}

export function listen(onText: (text: string, final: boolean) => void, lang = 'en-US'): () => void {
  const C = Ctor();
  if (!C) throw new Error('Speech recognition not supported');
  const r = new C();
  r.lang = lang; r.interimResults = true; r.continuous = true; r.processLocally = true;
  r.onresult = (e) => {
    let text = ''; let final = true;
    for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; final &&= e.results[i].isFinal; }
    onText(text.trim(), final);
  };
  r.start();
  return () => r.stop();
}
