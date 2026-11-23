// Model output is untrusted. Anything that does not fit the schema becomes "unknown", never a guess.
import { EMPTY_EXTRACTION, type DeviceType, type Extraction, type Need, type Tri } from './types';

const TRI: Tri[] = ['yes', 'no', 'unknown'];
const DEVICES: DeviceType[] = ['none', 'oxygen_concentrator', 'ventilator', 'cpap', 'suction', 'other_powered_medical', 'unknown'];
const POWER = ['ok', 'none', 'unknown'] as const;
const NEEDS: Need[] = ['water', 'food', 'shelter', 'power', 'medication', 'medical_transport', 'evacuation', 'baby_supplies', 'mobility_help', 'sanitation'];

const tri = (v: unknown): Tri => (TRI.includes(v as Tri) ? (v as Tri) : 'unknown');
const count = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 30 ? (v as number) : -1);
const amount = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 100) / 100 : -1;

export function normalizeExtraction(raw: unknown): Extraction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    ...EMPTY_EXTRACTION,
    descriptor: typeof r.descriptor === 'string' ? r.descriptor.slice(0, 60).trim() : '',
    adults: count(r.adults),
    over65: count(r.over65),
    children: count(r.children),
    infantsUnder1: count(r.infantsUnder1),
    livesAlone: tri(r.livesAlone),
    deviceType: DEVICES.includes(r.deviceType as DeviceType) ? (r.deviceType as DeviceType) : 'unknown',
    devicePower: POWER.includes(r.devicePower as (typeof POWER)[number]) ? (r.devicePower as Extraction['devicePower']) : 'unknown',
    deviceBatteryHours: amount(r.deviceBatteryHours, 168),
    dialysis: tri(r.dialysis),
    dialysisLastSessionHoursAgo: amount(r.dialysisLastSessionHoursAgo, 720),
    insulin: tri(r.insulin),
    insulinRefrigerated: tri(r.insulinRefrigerated),
    insulinSupplyDays: amount(r.insulinSupplyDays, 365),
    hasCooling: tri(r.hasCooling),
    mobilityLimited: tri(r.mobilityLimited),
    waterDaysLeft: amount(r.waterDaysLeft, 60),
    infantFormulaDaysLeft: amount(r.infantFormulaDaysLeft, 60),
    needs: Array.isArray(r.needs) ? [...new Set(r.needs.filter((n): n is Need => NEEDS.includes(n as Need)))] : [],
  };
}

/** Parse a model reply that should be JSON, tolerating ```json fences. */
export function parseModelJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { return null; }
}
