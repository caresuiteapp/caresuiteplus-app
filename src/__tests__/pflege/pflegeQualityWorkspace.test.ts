import { describe, expect, it } from 'vitest';
import { parsePflegeQualityStats } from '@/lib/pflege/pflegeQualityWorkspace';

const aggregate = { activePlans: 17, sisAssessmentsDue: 0, vitalsDocumentedThisWeek: 186, woundCasesOpen: 4, mdkReadyCount: 3 };

describe('Pflege quality statistics received from the database', () => {
  it('accepts a complete aggregate, including measured zero', () => {
    expect(parsePflegeQualityStats(aggregate)).toEqual(aggregate);
  });

  it.each([undefined, null, false, '', '0', NaN, -1, 1.25, Number.MAX_SAFE_INTEGER + 1])(
    'rejects %s as an unavailable or invalid count instead of displaying zero',
    (value) => {
      expect(parsePflegeQualityStats({ ...aggregate, sisAssessmentsDue: value })).toBeNull();
    },
  );
});
