import { describe, expect, it } from 'vitest';
import { planTeams } from './plan';
import type { CloudHousehold } from './payload';

const hh = (ref: string, zone: string, priority: string, hoursLeft: number | null, overdue = false, ask: string[] = []): CloudHousehold => ({
  ref, building: ref, zone, priority, hoursLeft, overdue, hazards: [], ask,
  people: { adults: -1, over65: -1, children: -1, infantsUnder1: -1 }, needs: [], mobilityLimited: 'unknown', lastVisitHoursAgo: 0, visits: 1,
});

describe('team planning is code, not AI', () => {
  it('puts overdue first, then priority, then time left; skips routine households with nothing to ask', () => {
    const plans = planTeams([
      hh('a', 'Z1', 'P2', 10), hh('b', 'Z1', 'P1', 2), hh('c', 'Z2', 'P1', 5, false),
      hh('d', 'Z2', 'P1', -1, true), hh('e', 'Z3', 'P3', null), hh('f', 'Z3', 'P3', null, false, ['Does the device have power?']),
    ], 2);
    const all = plans.flatMap((p) => p.stops.map((s) => s.ref));
    expect(all).not.toContain('e');
    expect(all).toContain('f');
    expect(plans[0].stops[0].ref).toBe('d'); // the overdue zone goes to Team 1, first stop
    expect(plans).toHaveLength(2);
  });
});
