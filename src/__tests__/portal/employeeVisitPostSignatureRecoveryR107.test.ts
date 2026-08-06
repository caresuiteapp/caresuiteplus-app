import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit post-signature recovery R10.7', () => {
  it('never uses an overlapping interval for signature confirmation', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).not.toContain('const poll = setInterval');
    expect(screen).toContain('attempts < 3');
    expect(screen).toContain('await signatureConfirmationRefreshRef.current()');
    expect(screen).toContain('cancelled = true');
  });

  it('keeps an already loaded visit visible during background refresh', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('if (loading && !visit)');
  });

  it('normalizes missing task arrays before any post-signature render', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const summary = read('src/components/portal/EmployeePortalVisitSummaryPanel.tsx');
    expect(screen).toContain("Array.isArray(visit?.tasks) ? visit.tasks : []");
    expect(screen).not.toContain('visit.tasks.filter');
    expect(screen).not.toContain('tasks={visit.tasks}');
    expect(summary).toContain('Array.isArray(visit.tasks) ? visit.tasks : []');
  });

  it('does not navigate the route from the background confirmation effect', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    const effectStart = screen.indexOf('if (!signatureConfirmationPending) return;');
    const effectEnd = screen.indexOf('useEffect(() => {', effectStart + 1);
    const effect = screen.slice(effectStart, effectEnd);
    expect(effect).not.toContain('workflowPersistence.setStep');
    expect(effect).not.toContain('router.');
  });

  it('renders a visible recovery surface instead of the blue shell after a render exception', () => {
    const route = read('app/portal/employee/assignments/[id]/execute.tsx');
    const boundary = read('src/components/portal/EmployeePortalExecutionErrorBoundary.tsx');
    expect(route).toContain('EmployeePortalExecutionErrorBoundary');
    expect(boundary).toContain('Der Einsatz bleibt gespeichert');
    expect(boundary).toContain('Einsatzansicht erneut aufbauen');
    expect(boundary).toContain('Zur Einsatzübersicht');
  });
});
