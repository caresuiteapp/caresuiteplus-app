import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildVisitProgress } from '@/lib/portal/visitProgress';

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

  it('keeps optional tasks out of the blocking step and guides directly to documentation', () => {
    const progress = buildVisitProgress({ status: 'beendet', serviceEnded: true, documentationComplete: false, requiresSignature: true, signatureCaptured: false });
    expect(progress.steps.map((step) => step.label)).toEqual(['Anfahrt', 'Einsatz', 'Doku', 'Unterschrift', 'Abschluss']);
    expect(progress.steps[progress.current].label).toBe('Doku');
    expect(progress.steps.find((step) => step.label === 'Unterschrift')?.done).toBe(false);
  });

  it('offers documentation as the explicit next action after the final task', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const allTasksComplete');
    expect(screen).toContain('Aufgaben sind optional');
    expect(screen).toContain('guideCanOpenDocumentation');
    expect(screen).toContain("? 'Jetzt Doku öffnen'");
    expect(screen).toContain('? () => setDocumentationOpen(true)');
  });
});
