import { describe, expect, it } from 'vitest';
import rulebook from '../../../shared/rulebook.example.json';
import { assertCloudSafe, toCloudHousehold } from './payload';
import { EMPTY_EXTRACTION, type Household, type Rulebook } from './types';

const rb = rulebook as Rulebook;

const leaky = {
  ...EMPTY_EXTRACTION,
  id: 'abcdef123456', incidentId: 'demo', buildingId: 'B12', reportedAt: 0, reportedBy: 'uid-volunteer-7',
  source: 'on_device', rulebookVersion: rb.version, visits: 1,
  descriptor: "Mrs Adaeze Okafor's house, blue door",
  deviceType: 'oxygen_concentrator', devicePower: 'none', deviceBatteryHours: 3,
  // Things that live only on the volunteer's phone - even if they ever end up on the object:
  transcript: 'Adaeze Okafor, 78, on oxygen, phone 0803 555 0101',
  photo: 'data:image/jpeg;base64,AAAA',
} as unknown as Household;

describe('cloud payload privacy', () => {
  const p = toCloudHousehold(leaky, { id: 'B12', zone: 'Z3', x: 0, y: 0, label: '' }, 'flood', rb, 0);
  const json = JSON.stringify(p);

  it('contains no name, descriptor, transcript, photo or volunteer id', () => {
    for (const s of ['Adaeze', 'Okafor', 'blue door', '0803', 'base64', 'uid-volunteer-7']) {
      expect(json).not.toContain(s);
    }
  });

  it('still carries what the coordinator needs', () => {
    expect(p.priority).toBe('P1');
    expect(p.hoursLeft).toBe(2);
    expect(p.hazards).toContain('Oxygen concentrator without power');
  });

  it('runtime guard blocks forbidden keys anywhere in a request', () => {
    expect(() => assertCloudSafe({ households: [p] })).not.toThrow();
    expect(() => assertCloudSafe({ households: [{ ...p, transcript: 'x' }] })).toThrow(/transcript/);
    expect(() => assertCloudSafe({ deep: { name: 'x' } })).toThrow(/name/);
  });
});
