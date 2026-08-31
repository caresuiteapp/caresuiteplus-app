import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('employee portal P0 task persistence', () => {
  it('persists single and batch task changes against the resolved physical assignment', () => {
    const source = read('src/lib/portal/employeePortalExecutionLiveService.ts');
    const resolvedIdDeclarations = source.match(/const persistentAssignmentId = existing\.data\.id;/g) ?? [];

    expect(resolvedIdDeclarations.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/updateTask\(\s*tenantId,\s*persistentAssignmentId,/s);
    expect(source).toMatch(/updateTasksBatch\(\s*tenantId,\s*persistentAssignmentId,/s);
  });

  it('projects visit documentation and proof dimensions instead of guessing from aggregate incomplete', () => {
    const liveAppointments = read('src/lib/portal/portalAppointmentsLiveService.ts');
    const completion = read('src/lib/portal/employeePortalAssignmentCompletion.ts');

    expect(liveAppointments).toContain("documentationPending: item.documentationStatus === 'open'");
    expect(liveAppointments).toContain("item.proofStatus === 'pending' || item.proofStatus === 'rejected'");
    expect(completion).not.toContain("input.status === 'abgeschlossen' && input.assignmentIncomplete === true");
  });
});
