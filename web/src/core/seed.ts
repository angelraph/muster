// Synthetic demo neighbourhood: every known building, so unvisited homes can be shown.
// In a real incident this list would come from an address or building-footprint import.
import type { Building } from './payload';

const STREETS = ['River Rd', 'Mill St', 'Church Ln', 'Market St', 'Hill Ave', 'Bridge St'];

export function demoBuildings(): Building[] {
  const out: Building[] = [];
  STREETS.forEach((street, row) => {
    for (let i = 0; i < 10; i++) {
      const n = (i + 1) * 2 + (row % 2);
      out.push({
        id: `B${row}${String(i).padStart(2, '0')}`,
        zone: `Z${row * 2 + Math.floor(i / 5) + 1}`,
        x: 60 + i * 64,
        y: 50 + row * 70,
        label: `${n} ${street}`,
      });
    }
  });
  return out;
}

export const DEMO_STREETS = STREETS;
