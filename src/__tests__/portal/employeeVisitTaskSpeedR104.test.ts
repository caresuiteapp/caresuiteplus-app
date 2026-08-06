import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit task speed R10.4', () => {
  it('confirms task taps optimistically without blocking every category button', () => {
    const drafts = read('src/hooks/useTaskResultDrafts.ts');
    const panel = read('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    expect(drafts).toContain("return { ok: true as const }");
    expect(panel).toContain('await Promise.all(');
    expect(panel).not.toContain('loading={loading}');
    expect(panel).toContain('Speicherung läuft im Hintergrund');
  });

  it('does not reload the complete execution context after a task batch', () => {
    const batch = read('src/features/assistWorkflow/saveTaskResultsBatch.ts');
    const liveService = read('src/lib/portal/employeePortalExecutionLiveService.ts');
    expect(batch).not.toContain("from './resolveAssistExecutionContext'");
    expect(batch).toContain('ctx.detail');
    expect(liveService).toContain('knownDetail?: EmployeePortalAssignmentDetail');
    expect(liveService).toContain('avoids extra reads');
  });

  it('never leaves the saving state stuck and preserves newer taps during a pending write', () => {
    const drafts = read('src/hooks/useTaskResultDrafts.ts');
    expect(drafts).toContain('revision: ++revisionRef.current');
    expect(drafts).toContain('pendingRef.current[taskId]?.revision === savedDraft.revision');
    expect(drafts).toContain('finally {');
    expect(drafts).toContain('setSaving(false)');
  });

  it('moves the animated robot from tasks to documentation immediately', () => {
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    expect(progress).toContain('tasksComplete?: boolean');
    expect(progress).toContain('documentationComplete?: boolean');
    expect(progress).toContain('tasksComplete || currentStep');
    expect(header).toContain('tasksComplete={tasksComplete}');
  });

  it('offers documentation as the explicit next action after the final task', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const allTasksComplete');
    expect(screen).toContain('Weiter geht es jetzt mit der Dokumentation.');
    expect(screen).toContain("? 'Jetzt Doku öffnen'");
    expect(screen).toContain('? () => setDocumentationOpen(true)');
  });
});
