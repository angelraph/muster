import { describe, expect, it } from 'vitest';
import { routeStops, type RouteParams } from './route';

const P: RouteParams = { metresPerUnit: 1.4, kmh: 12, serviceMin: 8, detour: 1, depot: { x: 20, y: 230 } };
import type { CloudHousehold } from './payload';

const h = (ref: string, building: string, hoursLeft: number | null, extra: Partial<CloudHousehold> = {}): CloudHousehold => ({
  ref, building, zone: 'Z1', priority: 'P1', hoursLeft, overdue: false, hazards: [], ask: [],
  people: { adults: 1, over65: 0, children: 0, infantsUnder1: 0 }, needs: [], mobilityLimited: 'unknown', lastVisitHoursAgo: 1, visits: 1, ...extra,
});
const coords: Record<string, { x: number; y: number }> = { near: { x: 30, y: 230 }, far: { x: 600, y: 230 }, mid: { x: 300, y: 230 } };
const at = (id: string | null) => (id ? coords[id] : null);

describe('deadline-aware routing', () => {
  it('goes to the tighter clock first even if it is further away', () => {
    const r = routeStops([h('a', 'near', 6), h('b', 'far', 0.5)], at, P);
    expect(r.map((s) => s.ref)).toEqual(['b', 'a']);
  });
  it('overdue beats everything', () => {
    const r = routeStops([h('a', 'near', 0.2), h('b', 'far', null, { overdue: true })], at, P);
    expect(r[0].ref).toBe('b');
  });
  it('flags stops that will be reached after their deadline', () => {
    const r = routeStops([h('a', 'far', 0.05)], at, P);
    expect(r[0].late).toBe(true);
    expect(r[0].slackMin).toBeLessThan(0);
  });
  it('ETA grows along the route', () => {
    const r = routeStops([h('a', 'near', 5), h('b', 'mid', 6), h('c', 'far', 7)], at, P);
    expect(r[0].etaMin).toBeLessThanOrEqual(r[1].etaMin);
    expect(r[1].etaMin).toBeLessThan(r[2].etaMin);
  });
});
