import { describe, expect, it } from 'vitest';
import { findDuplicates, mergeHouseholds } from './merge';
import { EMPTY_EXTRACTION, type Household } from './types';

const hh = (o: Partial<Household>): Household => ({
  ...EMPTY_EXTRACTION, id: Math.random().toString(36), incidentId: 'd', buildingId: 'B1', reportedAt: 0,
  reportedBy: 'v1', source: 'tap', rulebookVersion: 'x', visits: 1, ...o,
});

describe('duplicate households', () => {
  it('proposes a merge when two volunteers report the same door', () => {
    const a = hh({ reportedBy: 'v1', reportedAt: 10, deviceType: 'oxygen_concentrator', over65: 1 });
    const b = hh({ reportedBy: 'v2', reportedAt: 5, deviceType: 'oxygen_concentrator', over65: 1, livesAlone: 'yes' });
    const [p] = findDuplicates([a, b]);
    expect(p.keep).toBe(a);
    expect(p.reasons).toContain('Same medical device');
    const m = mergeHouseholds(p.keep, p.drop);
    expect(m.livesAlone).toBe('yes'); // known fact kept from the older visit
    expect(m.visits).toBe(2);
  });

  it('does not merge conflicting households', () => {
    const a = hh({ reportedBy: 'v1', over65: 1 });
    const b = hh({ reportedBy: 'v2', over65: 3 });
    expect(findDuplicates([a, b])).toHaveLength(0);
  });
});
