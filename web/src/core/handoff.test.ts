import { describe, expect, it } from 'vitest';
import { encodeFrames, FrameCollector } from './handoff';
import { EMPTY_EXTRACTION, type Household } from './types';

const many: Household[] = Array.from({ length: 40 }, (_, i) => ({
  ...EMPTY_EXTRACTION, id: `h${i}-${'x'.repeat(20)}`, incidentId: 'demo', buildingId: `B${i}`, reportedAt: 1800000000000 + i,
  reportedBy: `v${i % 3}`, source: 'tap', rulebookVersion: 'example', visits: 1, over65: i % 2, needs: ['water', 'food'],
}));

describe('QR handoff', () => {
  it('round-trips records through shuffled, repeated frames', async () => {
    const frames = await encodeFrames(many);
    expect(frames.length).toBeGreaterThan(1);
    const c = new FrameCollector();
    for (const f of [...frames].reverse().concat(frames)) c.add(f);
    expect(c.complete).toBe(true);
    expect(await c.households()).toEqual(many);
  });

  it('ignores non-Muster QR codes', () => {
    expect(new FrameCollector().add('https://example.com')).toBe(false);
  });
});
