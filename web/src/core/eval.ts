// Scoring for the extraction accuracy test. Pure functions, unit-tested.
import { assess } from './rules';
import { EMPTY_EXTRACTION, type Extraction, type Rulebook } from './types';

export const FIELDS: (keyof Extraction)[] = ['adults', 'over65', 'children', 'infantsUnder1', 'livesAlone', 'deviceType', 'devicePower', 'deviceBatteryHours',
  'dialysis', 'dialysisLastSessionHoursAgo', 'insulin', 'insulinRefrigerated', 'insulinSupplyDays', 'hasCooling', 'mobilityLimited', 'waterDaysLeft', 'infantFormulaDaysLeft', 'needs'];

const TOL: Partial<Record<keyof Extraction, number>> = { deviceBatteryHours: 0.5, dialysisLastSessionHoursAgo: 6, insulinSupplyDays: 0.5, waterDaysLeft: 0.5, infantFormulaDaysLeft: 0.25 };

export const withDefaults = (t: Partial<Extraction>): Extraction => ({ ...EMPTY_EXTRACTION, ...t });

export function fieldMatch(k: keyof Extraction, got: Extraction, want: Extraction): number {
  const g = got[k], w = want[k];
  if (k === 'needs') {
    const a = new Set(g as string[]), b = new Set(w as string[]);
    if (!a.size && !b.size) return 1;
    const inter = [...a].filter((x) => b.has(x)).length;
    return inter / new Set([...a, ...b]).size;
  }
  if (typeof w === 'number') return Math.abs((g as number) - w) <= (TOL[k] ?? 0) ? 1 : 0;
  return g === w ? 1 : 0;
}

export interface NoteScore { id: string; fieldAcc: number; stated: number; statedAcc: number; priorityOk: boolean; unsafeMiss: boolean; wantPriority: string; gotPriority: string; wrong: string[] }

/** fieldAcc: all 18 fields. statedAcc: only fields the note actually states (the hard part). unsafeMiss: truth is urgent but extraction is not. */
export function scoreNote(id: string, got: Extraction, truthPartial: Partial<Extraction>, incident: string, rb: Rulebook): NoteScore {
  const want = withDefaults(truthPartial);
  const statedKeys = Object.keys(truthPartial) as (keyof Extraction)[];
  const m = FIELDS.map((k) => fieldMatch(k, got, want));
  const now = Date.now();
  const pw = assess(want, incident, rb, now, now).priority;
  const pg = assess(got, incident, rb, now, now).priority;
  return {
    id,
    fieldAcc: m.reduce((s, x) => s + x, 0) / FIELDS.length,
    stated: statedKeys.length,
    statedAcc: statedKeys.length ? statedKeys.reduce((s, k) => s + fieldMatch(k, got, want), 0) / statedKeys.length : 1,
    priorityOk: pw === pg,
    unsafeMiss: pw === 'P1' && pg !== 'P1',
    wantPriority: pw, gotPriority: pg,
    wrong: FIELDS.filter((k, i) => m[i] < 1),
  };
}

export interface Summary { n: number; fieldAcc: number; statedAcc: number; priorityAgree: number; unsafeMisses: number; avgMs: number }
export function summarise(scores: NoteScore[], ms: number[]): Summary {
  const n = scores.length || 1;
  return {
    n: scores.length,
    fieldAcc: scores.reduce((s, x) => s + x.fieldAcc, 0) / n,
    statedAcc: scores.reduce((s, x) => s + x.statedAcc, 0) / n,
    priorityAgree: scores.filter((x) => x.priorityOk).length / n,
    unsafeMisses: scores.filter((x) => x.unsafeMiss).length,
    avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0,
  };
}
