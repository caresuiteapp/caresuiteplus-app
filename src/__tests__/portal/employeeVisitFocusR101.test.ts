import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_ACTION_TIMEOUT_MS,
  WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
  WORKFLOW_END_SERVICE_TIMEOUT_MS,
  WORKFLOW_FINALIZE_TIMEOUT_MS,
  WORKFLOW_MARK_ARRIVED_TIMEOUT_MS,
  WORKFLOW_START_SERVICE_TIMEOUT_MS,
} from '@/features/assistWorkflow/internal/withWorkflowTimeout';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('employee visit focus R10.1', () => {
  it('renders one full-screen workspace instead of the old stacked card page', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('employee-visit-fullscreen-workspace');
    expect(screen).toContain('styles.focusRoot');
    expect(screen).toContain('styles.focusStageViewport');
    expect(screen).not.toContain('<PremiumCard');
    expect(screen).not.toContain('Zurück zur Übersicht</');
  });

  it('keeps one robot in the help button instead of duplicating it in progress', () => {
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');
    expect(header).toContain('source={CARESUITE_VISIT_GUIDE_MASCOT}');
    expect(progress).not.toContain('CARESUITE_VISIT_GUIDE_MASCOT');
    expect(header).toContain('employee-visit-guide-toggle');
    expect(header).not.toContain('>👤<');
    expect(progress).not.toContain('>👤<');
  });

  it('keeps workflow problems visible while detailed guidance is optional', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).not.toContain('<ErrorState message={localError}');
    expect(screen).not.toContain('<ErrorState message={taskSaveError}');
    expect(screen).not.toContain('message={formatExecutionSyncWarning(syncWarning)}');
    expect(screen).toContain("? 'Status erneut prüfen'");
    expect(screen).toContain("? 'Jetzt Doku öffnen'");
  });

  it('does not classify normal mobile latency as a four-second workflow failure', () => {
    expect(WORKFLOW_ACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
    expect(WORKFLOW_MARK_ARRIVED_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
    expect(WORKFLOW_END_SERVICE_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
    expect(WORKFLOW_START_SERVICE_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
    expect(WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(WORKFLOW_FINALIZE_TIMEOUT_MS).toBeGreaterThanOrEqual(25_000);

    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain('A timeout means "confirmation pending", never "write failed"');
    expect(hook).not.toContain('länger als vier Sekunden');
  });
});
