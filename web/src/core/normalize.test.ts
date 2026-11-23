import { describe, expect, it } from 'vitest';
import { normalizeExtraction, parseModelJson } from './normalize';

describe('model output is untrusted', () => {
  it('turns invented values into unknown instead of guessing', () => {
    const e = normalizeExtraction({
      adults: 2.5, over65: -3, livesAlone: 'probably', deviceType: 'oxygen tank', devicePower: 'none',
      deviceBatteryHours: 9999, needs: ['water', 'water', 'pizza'], descriptor: 'x'.repeat(200),
    });
    expect(e.adults).toBe(-1);
    expect(e.over65).toBe(-1);
    expect(e.livesAlone).toBe('unknown');
    expect(e.deviceType).toBe('unknown');
    expect(e.devicePower).toBe('none');
    expect(e.deviceBatteryHours).toBe(-1);
    expect(e.needs).toEqual(['water']);
    expect(e.descriptor.length).toBe(60);
  });

  it('garbage in -> all unknown', () => {
    expect(normalizeExtraction(null).dialysis).toBe('unknown');
    expect(parseModelJson('not json')).toBeNull();
    expect(parseModelJson('```json\n{"adults":2}\n```')).toEqual({ adults: 2 });
  });
});
