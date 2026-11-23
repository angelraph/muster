// Duplicate detection is code, not AI: two volunteers often knock on the same door.
// The coordinator confirms every merge.
import type { Household } from './types';

export interface MergeProposal { keep: Household; drop: Household; reasons: string[] }

const agree = (a: number, b: number) => a < 0 || b < 0 || a === b;

export function findDuplicates(list: Household[]): MergeProposal[] {
  const byBuilding = new Map<string, Household[]>();
  for (const h of list) if (h.buildingId) byBuilding.set(h.buildingId, [...(byBuilding.get(h.buildingId) ?? []), h]);
  const out: MergeProposal[] = [];
  for (const group of byBuilding.values()) {
    const sorted = [...group].sort((a, b) => b.reportedAt - a.reportedAt);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const [a, b] = [sorted[i], sorted[j]];
        if (a.reportedBy === b.reportedBy) continue; // same volunteer = intentional second household
        const conflicts = !agree(a.over65, b.over65) || !agree(a.infantsUnder1, b.infantsUnder1) ||
          (a.deviceType !== 'none' && b.deviceType !== 'none' && a.deviceType !== 'unknown' && b.deviceType !== 'unknown' && a.deviceType !== b.deviceType);
        if (conflicts) continue;
        const reasons = ['Same building', 'Reported by different volunteers'];
        if (a.deviceType === b.deviceType && a.deviceType !== 'none') reasons.push('Same medical device');
        if (a.over65 > 0 && a.over65 === b.over65) reasons.push('Same number of people over 65');
        out.push({ keep: a, drop: b, reasons });
      }
    }
  }
  return out;
}

/** Newest visit wins, but never throw away a known fact for an unknown one. */
export function mergeHouseholds(keep: Household, drop: Household): Household {
  const out: Household = { ...keep, visits: keep.visits + drop.visits };
  for (const k of Object.keys(keep) as (keyof Household)[]) {
    const v = keep[k], o = drop[k];
    if ((v === 'unknown' || v === -1 || v === '') && o !== undefined) (out as unknown as Record<string, unknown>)[k] = o;
  }
  out.needs = [...new Set([...keep.needs, ...drop.needs])];
  return out;
}
