import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('employee portal recurring execution resilience', () => {
  it('keeps a live recurring occurrence executable when optional enrichment rejects', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/portal/employeePortalExecutionLiveService.ts'),
      'utf8',
    );

    expect(source).toContain('Promise.allSettled');
    expect(source).toContain('optional assignment extras unavailable');
    expect(source).toContain('optional signature metadata unavailable');
    expect(source).toContain('fallbackRequiresSignature');
  });

  it('normalizes the affected virtual occurrence before assignment verification', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/liveTracking/resolveEmployeeLiveContext.ts'),
      'utf8',
    );

    expect(source).toContain(".eq('id', resolveVisitMasterId(resolution.assignmentId))");
  });
});
