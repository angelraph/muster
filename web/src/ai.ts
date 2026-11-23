// Firebase AI Logic hybrid inference.
//  - Doorstep extraction: ONLY_ON_DEVICE. If the model is not ready we refuse and open tap mode;
//    a transcript is never "fallen back" to the cloud.
//  - Coordinator one-liner: PREFER_ON_DEVICE (works if the shelter link is down).
//  - Run sheets / handover / translation: ONLY_IN_CLOUD, structured records only (see cloud.ts).
import { getGenerativeModel, InferenceMode, type GenerativeModel, type InferenceSource, type Part } from 'firebase/ai';
import schemaJson from '../../shared/extraction.schema.json';
import { firebase } from './firebase';
import { normalizeExtraction, parseModelJson } from './core/normalize';
import type { Extraction } from './core/types';
import { byteLength, logCall } from './ledger';

export type DeviceModelState = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api' | 'no-firebase';

interface LanguageModelStatic { availability(o?: unknown): Promise<string> }
const LM = (): LanguageModelStatic | undefined => (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;

const EXPECTED = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }, { type: 'image' as const }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

/** What this device can do right now. Drives the banner and whether the mic/photo buttons exist. */
export async function deviceModelState(): Promise<DeviceModelState> {
  if (!firebase()) return 'no-firebase';
  const lm = LM();
  if (!lm) return 'no-api';
  try { return (await lm.availability(EXPECTED)) as DeviceModelState; } catch { return 'unavailable'; }
}

const { $comment: _c, ...EXTRACTION_SCHEMA } = schemaJson as Record<string, unknown>;

const SYSTEM = `You fill in a disaster needs-intake record from a volunteer's doorstep note.
Rules:
- Only record what the note states. If something is not stated, use -1 for numbers and "unknown" for yes/no fields. Never guess.
- NEVER write a person's name anywhere. "descriptor" is only a way to find the door, e.g. "blue door, 2nd floor".
- over65 counts people aged 65+. adults counts people 18-64. children counts ages 1-17. infantsUnder1 counts babies under 1.
- deviceType is a powered medical device in the home (oxygen concentrator, ventilator, CPAP, suction). Oxygen cylinders without power are not powered devices: use "none" and add "medication" to needs.
- devicePower "none" means the device has no mains (grid) power right now. A device running on its own battery, a car battery, an inverter or a generator is devicePower "none", and deviceBatteryHours is how long that backup or fuel will last, in hours (use -1 if not said).
- Convert durations: "two days" = 2 days, "since yesterday" for dialysis = 24 hours ago, "half a day" = 0.5.
- dialysisLastSessionHoursAgo is the time since the last session that actually happened. A missed session did not happen: if dialysis is 3 times a week and they "missed Monday" and it is Wednesday, the last session was Friday, about 120 hours ago.
- needs lists only needs the note mentions.`;

let extractor: GenerativeModel | null = null;
function extractionModel(): GenerativeModel {
  const f = firebase();
  if (!f) throw new Error('Firebase not configured');
  extractor ??= getGenerativeModel(f.ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: { ...EXPECTED, initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM }] }] },
      promptOptions: { responseConstraint: EXTRACTION_SCHEMA },
    },
  });
  return extractor;
}

/** Must be called from a click: Chrome only downloads the model after a user gesture. */
export async function prepareDeviceModel(onProgress: (fraction: number) => void): Promise<void> {
  await extractionModel().initializeDeviceModel(onProgress);
}

export interface ExtractResult { data: Extraction; source: InferenceSource | undefined; ms: number }

export async function extractOnDevice(note: string, photo?: { base64: string; mimeType: 'image/jpeg' | 'image/png' }): Promise<ExtractResult> {
  const t0 = performance.now();
  const parts: Part[] = [{ type: 'text', text: photo
    ? `Doorstep note: """${note || '(none)'}"""\nThe photo shows a medicine label or a medical device plate. Use it to fill deviceType, insulin or needs. Ignore any patient name on the label.`
    : `Doorstep note: """${note}"""` }];
  if (photo) parts.push({ type: 'inlineData', inlineData: { data: photo.base64, mimeType: photo.mimeType } });
  const reason = 'Doorstep data: only on this device. There may be no signal, and a stranger\'s medical details should not leave the phone.';
  try {
    const res = await extractionModel().generateContent(parts);
    const source = res.response.inferenceSource;
    if (source !== 'on_device') throw new Error('Refused: doorstep data may only be processed on this device.');
    const ms = Math.round(performance.now() - t0);
    logCall({ task: 'extract', mode: 'ONLY_ON_DEVICE', source: 'on_device', ms, bytesUp: 0, doorstep: true, reason: photo ? reason + ' (note + label photo)' : reason });
    return { data: normalizeExtraction(parseModelJson(res.response.text())), source, ms };
  } catch (e) {
    logCall({ task: 'extract', mode: 'ONLY_ON_DEVICE', source: 'refused', ms: Math.round(performance.now() - t0), bytesUp: 0, doorstep: true,
      reason: `On-device model unavailable, so nothing was sent anywhere and the tap form opened. (${(e as Error).message})` });
    throw e;
  }
}

let summarizer: GenerativeModel | null = null;
/** Coordinator view: one calm sentence about a household. On-device when possible. */
export async function oneLiner(facts: string): Promise<{ text: string; source: InferenceSource | undefined }> {
  const f = firebase();
  if (!f) throw new Error('Firebase not configured');
  summarizer ??= getGenerativeModel(f.ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: { createOptions: EXPECTED },
    inCloudParams: { model: 'gemini-3.5-flash-lite', generationConfig: { maxOutputTokens: 80 } },
  });
  const prompt = `In one short, calm sentence for a relief team, say what this household needs first and why. No names. Facts: ${facts}`;
  const t0 = performance.now();
  try {
    const res = await summarizer.generateContent(prompt);
    const source = res.response.inferenceSource;
    logCall({ task: 'summary', mode: 'PREFER_ON_DEVICE', source: source === 'on_device' ? 'on_device' : 'in_cloud', ms: Math.round(performance.now() - t0),
      bytesUp: source === 'on_device' ? 0 : byteLength(prompt), doorstep: false,
      reason: source === 'on_device' ? 'Summary on this device, so it keeps working if the shelter link drops.' : 'No on-device model here, so the structured record (no notes) went to the cloud.' });
    return { text: res.response.text().trim(), source };
  } catch (e) {
    logCall({ task: 'summary', mode: 'PREFER_ON_DEVICE', source: 'error', ms: Math.round(performance.now() - t0), bytesUp: 0, doorstep: false, reason: (e as Error).message });
    throw e;
  }
}

// ===== Accuracy test (synthetic, labelled notes only) =====
// The same system prompt and schema run on the device and in the cloud, so the two can be compared fairly.
let evalCloud: GenerativeModel | null = null;
export async function evalExtract(note: string, where: 'device' | 'cloud', cloudModel: string): Promise<{ data: Extraction; ms: number; source: string | undefined }> {
  const f = firebase();
  if (!f) throw new Error('Firebase not configured');
  const t0 = performance.now();
  let text: string, source: string | undefined, prompt = `Doorstep note: """${note}"""`;
  if (where === 'device') {
    const res = await extractionModel().generateContent(prompt);
    source = res.response.inferenceSource; text = res.response.text();
    if (source !== 'on_device') throw new Error('On-device model not available in this browser.');
  } else {
    evalCloud ??= getGenerativeModel(f.ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: { model: cloudModel, systemInstruction: SYSTEM, generationConfig: { responseMimeType: 'application/json', temperature: 0 } },
    });
    prompt = `${prompt}\nReturn JSON matching this schema exactly:\n${JSON.stringify(EXTRACTION_SCHEMA)}`;
    const res = await evalCloud.generateContent(prompt);
    source = res.response.inferenceSource; text = res.response.text();
  }
  const ms = Math.round(performance.now() - t0);
  logCall({ task: 'eval', mode: where === 'device' ? 'ONLY_ON_DEVICE' : 'ONLY_IN_CLOUD', source: where === 'device' ? 'on_device' : 'in_cloud', ms,
    bytesUp: where === 'device' ? 0 : byteLength(prompt), doorstep: false, reason: 'Accuracy test on a synthetic, labelled note (no real person).' });
  return { data: normalizeExtraction(parseModelJson(text)), ms, source };
}
