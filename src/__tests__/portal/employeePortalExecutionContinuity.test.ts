import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSource = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8');

describe('employee portal execution continuity', () => {
  it('bridges portal visit ids to their linked legacy assignment before writes', () => {
    const resolver = readSource('src/features/liveTracking/resolveLiveAssignment.ts');
    const liveService = readSource('src/lib/portal/employeePortalExecutionLiveService.ts');

    expect(resolver).toContain('findLegacyAssignmentIdByVisit');
    expect(resolver).toContain("source: 'legacy_bridge'");
    expect(liveService).toContain('const persistentAssignmentId = existing.data.id');
    expect(liveService).toContain(
      'assignmentSupabaseRepository.updateStatus(\n    tenantId,\n    persistentAssignmentId,',
    );
  });

  it('writes documentation to the linked assignment and awaits the status transition', () => {
    const documentation = readSource(
      'src/features/assistWorkflow/saveVisitDocumentation.ts',
    );

    expect(documentation).toContain(
      'ctx.detail.assignmentId || ctx.assignmentId',
    );
    expect(documentation).toContain(
      "const transitioned = await transitionAssistExecutionStatus(ctx, 'dokumentation_offen'",
    );
    expect(documentation).not.toContain(
      "void transitionAssistExecutionStatus(ctx, 'dokumentation_offen'",
    );
  });
});
