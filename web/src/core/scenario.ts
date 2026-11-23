// Seeded demo incident for rehearsals and the video. Synthetic: no real people.
import { EMPTY_EXTRACTION, type Household } from './types';

const H = 3_600_000;

export function demoScenario(now: number, incidentId: string): Household[] {
  const base = (o: Partial<Household> & { id: string; buildingId: string; ago: number; by: string }): Household => {
    const { ago, by, ...rest } = o;
    return { ...EMPTY_EXTRACTION, dialysis: 'no', insulin: 'no', deviceType: 'none', incidentId, reportedAt: now - ago * H,
      reportedBy: by, source: 'tap', rulebookVersion: 'example-2026.11', visits: 1, ...rest };
  };
  return [
    base({ id: 'a1f3c9e2-oxygen', buildingId: 'B003', ago: 0.5, by: 'vol-amaka', source: 'on_device', descriptor: 'green gate, ground floor',
      over65: 1, adults: 1, deviceType: 'oxygen_concentrator', devicePower: 'none', deviceBatteryHours: 4, waterDaysLeft: 2, needs: ['power', 'water'] }),
    base({ id: 'b7d24a10-dialys', buildingId: 'B104', ago: 3, by: 'vol-tunde', source: 'tap', descriptor: 'flat 3',
      adults: 2, dialysis: 'yes', dialysisLastSessionHoursAgo: 66, mobilityLimited: 'yes', needs: ['medical_transport', 'evacuation'] }),
    base({ id: 'c93e5b71-infant', buildingId: 'B207', ago: 1, by: 'vol-amaka', source: 'on_device', descriptor: 'yellow house',
      adults: 2, children: 1, infantsUnder1: 1, infantFormulaDaysLeft: 0.5, waterDaysLeft: 0.5, needs: ['baby_supplies', 'water'] }),
    base({ id: 'd40a8c3f-alone', buildingId: 'B302', ago: 7, by: 'vol-tunde', source: 'tap', descriptor: 'end of row',
      over65: 1, livesAlone: 'yes', hasCooling: 'no', insulin: 'yes', insulinRefrigerated: 'no', insulinSupplyDays: 3, needs: ['medication'] }),
    base({ id: 'e5b19d62-unknwn', buildingId: 'B405', ago: 2.5, by: 'vol-ife', source: 'tap',
      over65: 2, deviceType: 'oxygen_concentrator', devicePower: 'unknown', needs: ['food'] }),
    base({ id: 'f62c7e04-family', buildingId: 'B509', ago: 4, by: 'vol-ife', source: 'on_device',
      adults: 2, children: 3, waterDaysLeft: 3, needs: ['food', 'sanitation'] }),
    // Same door as the oxygen household, reported by another volunteer earlier -> merge proposal
    base({ id: '0a7d3f95-oxydup', buildingId: 'B003', ago: 2, by: 'vol-ife', source: 'tap',
      over65: 1, livesAlone: 'no', deviceType: 'oxygen_concentrator', devicePower: 'none', needs: ['power'] }),
  ];
}
