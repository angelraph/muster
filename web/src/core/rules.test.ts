import { describe, expect, it } from 'vitest';
import vectors from '../../../shared/rule-test-vectors.json';
import rulebook from '../../../shared/rulebook.example.json';
import { assess } from './rules';
import type { Extraction, Rulebook } from './types';

const H = 3_600_000;
const rb = rulebook as Rulebook;

describe('shared rule test vectors (Android must pass the same file)', () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const h = { ...vectors.base, ...c.household } as Extraction;
      const at = vectors.reportedAt;
      const a = assess(h, c.incidentType, rb, at, at + c.nowH * H);
      expect(a.priority).toBe(c.expect.priority);
      expect(a.deadline === null ? null : (a.deadline - at) / H).toBe(c.expect.deadlineH);
      expect(a.overdue).toBe(c.expect.overdue);
      expect((a.nextCheckBy - at) / H).toBe(c.expect.nextCheckH);
      expect(a.hazards.map((z) => z.code)).toEqual(c.expect.hazards);
    });
  }
});
