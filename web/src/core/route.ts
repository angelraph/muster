// Deadline-aware routing, decided by code. The cloud only writes the words around it.
// Greedy earliest-deadline-first with travel time: at each step go to the stop whose clock is tightest
// once you count the drive there; overdue first, unknown-but-critical next.
import type { CloudHousehold } from './payload';
import { NEIGHBOURHOOD } from './seed';

export interface Point { x: number; y: number }
export interface RoutedStop extends CloudHousehold { etaMin: number; slackMin: number | null; late: boolean }
export interface RouteParams { metresPerUnit: number; kmh: number; serviceMin: number; depot: Point; detour: number }

/** Real map scale from the OpenStreetMap extract. Straight-line distance x1.35 approximates winding mountain roads;
 *  12 km/h is a cautious truck speed through flood debris; 8 min per stop. All three are agency-adjustable assumptions. */
export const DEFAULT_ROUTE: RouteParams = {
  metresPerUnit: NEIGHBOURHOOD.metresPerUnit, kmh: 12, serviceMin: 8, detour: 1.35,
  depot: NEIGHBOURHOOD.staging ? { x: NEIGHBOURHOOD.staging.x, y: NEIGHBOURHOOD.staging.y } : { x: 20, y: 230 },
};

const travelMin = (a: Point, b: Point, p: RouteParams) =>
  (Math.hypot(a.x - b.x, a.y - b.y) * p.metresPerUnit * p.detour) / ((p.kmh * 1000) / 60);

export function routeStops(stops: CloudHousehold[], coord: (buildingId: string | null) => Point | null, p: RouteParams = DEFAULT_ROUTE): RoutedStop[] {
  const left = [...stops];
  const out: RoutedStop[] = [];
  let here = p.depot, clock = 0;
  while (left.length) {
    let best = 0, bestKey = Infinity;
    left.forEach((s, i) => {
      const pt = coord(s.building) ?? here;
      const arrive = clock + travelMin(here, pt, p);
      // Key: minutes of slack left on arrival. Overdue = very negative. No deadline but P1 (unknown critical) ranks next.
      const slack = s.overdue ? -1e6 + arrive : s.hoursLeft !== null ? s.hoursLeft * 60 - arrive : s.priority === 'P1' ? 1e5 + arrive : 1e7 + arrive;
      if (slack < bestKey) { bestKey = slack; best = i; }
    });
    const s = left.splice(best, 1)[0];
    const pt = coord(s.building) ?? here;
    clock += travelMin(here, pt, p);
    const eta = Math.round(clock);
    const slackMin = s.hoursLeft === null ? null : Math.round(s.hoursLeft * 60 - eta);
    out.push({ ...s, etaMin: eta, slackMin, late: s.overdue || (slackMin !== null && slackMin < 0) });
    clock += p.serviceMin;
    here = pt;
  }
  return out;
}

export function formatMin(m: number): string {
  const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60;
  return `${m < 0 ? '−' : ''}${h ? `${h} h ` : ''}${mm} m`;
}
