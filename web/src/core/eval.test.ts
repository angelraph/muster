import { describe, expect, it } from 'vitest';
import rb from '../../../shared/rulebook.example.json';
import data from '../../../shared/eval/doorstep-notes.json';
import { scoreNote, summarise, withDefaults } from './eval';
import type { Extraction, Rulebook } from './types';

describe('extraction scoring', () => {
  it('a perfect extraction scores 1 and agrees on priority', () => {
    for (const n of data.notes) {
      const s = scoreNote(n.id, withDefaults(n.truth as Partial<Extraction>), n.truth as Partial<Extraction>, 'flood', rb as Rulebook);
      expect(s.fieldAcc).toBe(1); expect(s.priorityOk).toBe(true);
    }
  });
  it('missing the oxygen device is an unsafe miss', () => {
    const n = data.notes[0];
    const got = withDefaults({ ...(n.truth as Partial<Extraction>), deviceType: 'none' });
    const s = scoreNote(n.id, got, n.truth as Partial<Extraction>, 'flood', rb as Rulebook);
    expect(s.unsafeMiss).toBe(true);
    expect(s.wrong).toContain('deviceType');
  });
  it('summary averages', () => {
    const n = data.notes[2];
    const s = scoreNote(n.id, withDefaults(n.truth as Partial<Extraction>), n.truth as Partial<Extraction>, 'flood', rb as Rulebook);
    expect(summarise([s], [100]).avgMs).toBe(100);
  });
  it('has 30 labelled notes', () => expect(data.notes.length).toBe(30));
});
