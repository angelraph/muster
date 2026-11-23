// Time-to-harm rules engine. Pure code: the AI never decides who is helped first.
// The Kotlin copy in /android must pass the same /shared/rule-test-vectors.json.
import type { Assessment, Extraction, Hazard, IncidentType, Priority, Rulebook } from './types';

const H = 3_600_000;
const RANK: Record<Priority, number> = { P1: 1, P2: 2, P3: 3 };
const worst = (a: Priority, b: Priority): Priority => (RANK[a] <= RANK[b] ? a : b);
const known = (n: number) => typeof n === 'number' && n >= 0;

const DEVICE_LABEL: Record<string, string> = {
  oxygen_concentrator: 'Oxygen concentrator', ventilator: 'Ventilator', cpap: 'CPAP',
  suction: 'Suction machine', other_powered_medical: 'Powered medical device',
};

export function hazardsFor(h: Extraction, incident: IncidentType | string, rb: Rulebook, at: number): Hazard[] {
  const out: Hazard[] = [];

  // 1. Life-sustaining powered devices
  if (h.deviceType !== 'none' && h.deviceType !== 'unknown') {
    const name = DEVICE_LABEL[h.deviceType] ?? 'Powered device';
    if (h.devicePower === 'none') {
      const hours = known(h.deviceBatteryHours) ? h.deviceBatteryHours : rb.poweredDevice.assumedBatteryHoursWhenUnknown;
      const left = Math.max(0, hours - rb.poweredDevice.safetyMarginHours);
      out.push({
        code: 'powered_device', unknown: false, deadline: at + left * H,
        label: `${name} without power`,
        ask: known(h.deviceBatteryHours) ? undefined : 'How many hours of battery are left?',
      });
    } else if (h.devicePower === 'unknown') {
      out.push({ code: 'powered_device_unknown', unknown: true, deadline: null,
        label: `${name}: power status unknown`, ask: 'Does the device have power right now?' });
    }
  }

  // 2. Dialysis
  if (h.dialysis === 'yes') {
    if (known(h.dialysisLastSessionHoursAgo)) {
      const left = rb.dialysis.maxHoursBetweenSessions - h.dialysisLastSessionHoursAgo;
      out.push({ code: 'dialysis', unknown: false, deadline: at + left * H, label: 'Dialysis session due' });
    } else {
      out.push({ code: 'dialysis_unknown', unknown: true, deadline: null,
        label: 'On dialysis: last session unknown', ask: 'When was the last dialysis session?' });
    }
  }

  // 3. Insulin
  if (h.insulin === 'yes') {
    const candidates: number[] = [];
    if (h.insulinRefrigerated === 'no') {
      const days = rb.heat.incidentTypes.includes(incident) ? rb.insulin.unrefrigeratedDaysInHeat : rb.insulin.unrefrigeratedDays;
      candidates.push(days * 24);
    }
    if (known(h.insulinSupplyDays)) candidates.push(h.insulinSupplyDays * 24);
    if (candidates.length) {
      out.push({ code: 'insulin', unknown: false, deadline: at + Math.min(...candidates) * H,
        label: h.insulinRefrigerated === 'no' ? 'Insulin without refrigeration' : 'Insulin supply running out' });
    }
  }

  // 4. Heat: older, alone, no cooling (the 2021 heat-dome pattern)
  if (rb.heat.incidentTypes.includes(incident) && h.over65 > 0 && h.hasCooling !== 'yes') {
    if (h.livesAlone === 'yes' && h.hasCooling === 'no') {
      out.push({ code: 'heat_isolated', unknown: false, deadline: null, label: 'Over 65, alone, no cooling' });
    } else if (h.livesAlone === 'unknown' || h.hasCooling === 'unknown') {
      out.push({ code: 'heat_unknown', unknown: true, deadline: null, label: 'Over 65 in a heat wave: situation unclear',
        ask: h.livesAlone === 'unknown' ? 'Does this person live alone?' : 'Is there any working cooling?' });
    }
  }

  // 5. Supplies
  if (h.infantsUnder1 > 0 && known(h.infantFormulaDaysLeft) && h.infantFormulaDaysLeft < rb.supplies.warnBelowDays) {
    out.push({ code: 'infant_formula', unknown: false, deadline: at + h.infantFormulaDaysLeft * 24 * H, label: 'Baby formula running out' });
  }
  if (known(h.waterDaysLeft) && h.waterDaysLeft < rb.supplies.warnBelowDays) {
    out.push({ code: 'water', unknown: false, deadline: at + h.waterDaysLeft * 24 * H, label: 'Drinking water running out' });
  }

  // 6. Cannot leave without help
  if (h.mobilityLimited === 'yes' && h.needs.includes('evacuation')) {
    out.push({ code: 'assisted_evacuation', unknown: false, deadline: null, label: 'Needs help to evacuate' });
  }
  return out;
}

const CRITICAL_UNKNOWN = new Set(['powered_device_unknown', 'dialysis_unknown']);

export function assess(h: Extraction, incident: IncidentType | string, rb: Rulebook, reportedAt: number, now: number): Assessment {
  const hazards = hazardsFor(h, incident, rb, reportedAt);
  const deadlines = hazards.map((z) => z.deadline).filter((d): d is number => d !== null);
  const deadline = deadlines.length ? Math.min(...deadlines) : null;

  let priority: Priority = 'P3';
  if (deadline !== null) {
    const hoursLeft = (deadline - now) / H;
    priority = hoursLeft <= rb.priority.p1WithinHours ? 'P1' : hoursLeft <= rb.priority.p2WithinHours ? 'P2' : 'P3';
  }
  const caps: number[] = [];
  for (const z of hazards) {
    if (CRITICAL_UNKNOWN.has(z.code)) {
      priority = 'P1';
      caps.push(reportedAt + rb.unknownCriticalRecheckHours * H);
    } else if (z.code === 'heat_isolated') {
      priority = worst(priority, 'P2');
      caps.push(reportedAt + rb.heat.recheckHours * H);
    } else if (z.unknown || z.code === 'assisted_evacuation') {
      priority = worst(priority, 'P2');
    }
  }
  caps.push(reportedAt + rb.recheckHours[priority] * H);
  if (deadline !== null) caps.push(deadline);

  return { priority, deadline, overdue: deadline !== null && deadline < now, nextCheckBy: Math.min(...caps), hazards };
}

/** "2 h 58 m", "overdue 8 h", "3 d 4 h" */
export function formatLeft(ms: number): string {
  const neg = ms < 0;
  let m = Math.round(Math.abs(ms) / 60_000);
  const d = Math.floor(m / 1440); m -= d * 1440;
  const h = Math.floor(m / 60); m -= h * 60;
  const s = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} m` : `${m} m`;
  return neg ? `overdue ${s}` : s;
}
