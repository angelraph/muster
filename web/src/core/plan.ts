// Who goes where, in which order: decided by code, not by the model.
import type { CloudHousehold } from './payload';

export interface TeamPlan { team: string; zones: string[]; stops: CloudHousehold[] }

const RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };
const urgency = (h: CloudHousehold) => [h.overdue ? 0 : 1, RANK[h.priority] ?? 9, h.hoursLeft ?? 1e6];
const cmp = (a: CloudHousehold, b: CloudHousehold) => {
  const [x, y] = [urgency(a), urgency(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** Zones are dealt to teams by their most urgent stop, so the worst zone is covered first. */
export function planTeams(households: CloudHousehold[], teams: number): TeamPlan[] {
  const active = households.filter((h) => h.priority !== 'P3' || h.ask.length > 0);
  const byZone = new Map<string, CloudHousehold[]>();
  for (const h of active) byZone.set(h.zone, [...(byZone.get(h.zone) ?? []), h]);
  const zones = [...byZone.entries()].map(([zone, list]) => ({ zone, list: list.sort(cmp) })).sort((a, b) => cmp(a.list[0], b.list[0]));

  const plans: TeamPlan[] = Array.from({ length: Math.max(1, teams) }, (_, i) => ({ team: `Team ${i + 1}`, zones: [], stops: [] }));
  zones.forEach((z, i) => {
    // Snake order: 1,2,3,3,2,1 ... keeps load balanced.
    const n = plans.length, round = Math.floor(i / n), pos = i % n;
    const p = plans[round % 2 === 0 ? pos : n - 1 - pos];
    p.zones.push(z.zone);
    p.stops.push(...z.list);
  });
  for (const p of plans) p.stops.sort(cmp);
  return plans.filter((p) => p.stops.length > 0);
}
