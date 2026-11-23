import { describe, expect, it } from 'vitest';
import { applyAnswers, FLOW, LANGS, nextQuestion } from './language';
import { assess } from './rules';
import { EMPTY_EXTRACTION, type Household } from './types';
import rulebook from '../../../shared/rulebook.example.json';

describe('language card', () => {
  it('every language has every phrase', () => {
    const en = LANGS[0];
    for (const l of LANGS) {
      for (const k of Object.keys(en.card) as (keyof typeof en.card)[]) expect(l.card[k], `${l.code}.card.${k}`).toBeTruthy();
      for (const q of FLOW) expect(l.card.q[q.id], `${l.code}.q.${q.id}`).toBeTruthy();
      for (const k of Object.keys(en.resident) as (keyof typeof en.resident)[]) expect(l.resident[k], `${l.code}.resident.${k}`).toBeTruthy();
      for (const k of Object.keys(en.resident.needs)) expect((l.resident.needs as Record<string, string>)[k], `${l.code}.needs.${k}`).toBeTruthy();
    }
  });

  it('asks follow-ups only when they apply', () => {
    expect(nextQuestion({})?.id).toBe('people');
    expect(nextQuestion({ people: 2, over65: 'no', baby: 'no', device: 'no', power: 'yes', dialysis: 'no' })?.id).toBe('insulin');
    expect(nextQuestion({ people: 2, over65: 'no', baby: 'no', device: 'no', power: 'yes', dialysis: 'yes' })?.id).toBe('dialysisWhen');
  });

  it('turns taps into a record the rulebook marks urgent', () => {
    const d = applyAnswers(EMPTY_EXTRACTION, { people: 1, over65: 'yes', baby: 'no', device: 'yes', power: 'no', dialysis: 'no', insulin: 'no', water: 0, leave: 'yes' });
    expect(d).toMatchObject({ adults: 1, livesAlone: 'yes', over65: 1, deviceType: 'other_powered_medical', devicePower: 'none', waterDaysLeft: 0, mobilityLimited: 'yes' });
    expect(d.needs).toEqual(expect.arrayContaining(['power', 'water', 'evacuation']));
    const h = { ...d, id: 'x', incidentId: 'i', buildingId: null, reportedAt: 0, reportedBy: 'v', source: 'tap', rulebookVersion: '1', visits: 1 } as Household;
    expect(assess(h, 'hurricane', rulebook as never, 0, 0).priority).toBe('P1');
  });

  it('keeps "not sure" as unknown, never as safe', () => {
    const d = applyAnswers(EMPTY_EXTRACTION, { device: 'unsure', dialysis: 'unsure' });
    expect(d.deviceType).toBe('unknown');
    expect(d.dialysis).toBe('unknown');
  });
});
