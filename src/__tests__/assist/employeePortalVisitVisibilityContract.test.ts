import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'src/lib/assist/repositories/visitRepository.supabase.ts',
  'utf8',
);

describe('Assist employee portal visit visibility contract', () => {
  it('marks assigned non-draft visits visible when they are created', () => {
    expect(source).toContain(
      'employee_portal_visible: Boolean(input.employeeId) && !input.saveAsDraft',
    );
  });

  it('does not discard assigned visits because of a stale legacy visibility flag', () => {
    expect(source).not.toContain("query = query.eq('employee_portal_visible', true)");
    expect(source).not.toContain("flatQuery = flatQuery.eq('employee_portal_visible', true)");
  });

  it('permits untouched series rows with inherited execution state to be deleted', () => {
    expect(source).toContain('isSafelyDeletableSeriesOccurrence');
    expect(source).toContain('isSeriesVisit && !hasExecutionEvidence && !hasProtectedRecords');
  });
});
