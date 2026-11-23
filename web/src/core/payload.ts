// The only thing the cloud model is ever allowed to see.
// Built by whitelist: fields not listed here cannot leak, whatever else is on the record.
import { assess } from './rules';
import type { Household, IncidentType, Rulebook } from './types';

export interface CloudHousehold {
  ref: string;
  building: string | null;
  zone: string;
  priority: string;
  hoursLeft: number | null;
  overdue: boolean;
  hazards: string[];
  ask: string[];
  people: { adults: number; over65: number; children: number; infantsUnder1: number };
  needs: string[];
  mobilityLimited: string;
  lastVisitHoursAgo: number;
  visits: number;
}

export interface Building { id: string; zone: string; x: number; y: number; label: string }

const round1 = (n: number) => Math.round(n * 10) / 10;

export function toCloudHousehold(h: Household, b: Building | undefined, incident: IncidentType | string, rb: Rulebook, now: number): CloudHousehold {
  const a = assess(h, incident, rb, h.reportedAt, now);
  return {
    ref: h.id.slice(0, 8),
    building: h.buildingId,
    zone: b?.zone ?? 'unmapped',
    priority: a.priority,
    hoursLeft: a.deadline === null ? null : round1((a.deadline - now) / 3_600_000),
    overdue: a.overdue,
    hazards: a.hazards.map((z) => z.label),
    ask: a.hazards.flatMap((z) => (z.ask ? [z.ask] : [])),
    people: { adults: h.adults, over65: h.over65, children: h.children, infantsUnder1: h.infantsUnder1 },
    needs: [...h.needs],
    mobilityLimited: h.mobilityLimited,
    lastVisitHoursAgo: round1((now - h.reportedAt) / 3_600_000),
    visits: h.visits,
  };
}

/** Keys that must never appear in anything sent to the cloud. Checked in tests and at runtime. */
export const FORBIDDEN_KEYS = ['descriptor', 'transcript', 'photo', 'image', 'name', 'notes', 'reportedBy', 'phone', 'address'];

export function assertCloudSafe(payload: unknown): void {
  const walk = (v: unknown, path: string) => {
    if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.includes(k)) throw new Error(`Blocked: "${path}${k}" may not leave the device`);
        walk(child, `${path}${k}.`);
      }
    }
  };
  walk(payload, '');
}
