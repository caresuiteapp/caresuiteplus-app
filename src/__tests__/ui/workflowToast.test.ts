import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkflowToast', () => {
  const source = readFileSync('src/components/ui/WorkflowToast.tsx', 'utf8');
  const employeeExecutionSource = readFileSync(
    'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
    'utf8',
  );

  it('bleibt overlay-basiert und verschiebt kein Layout', () => {
    expect(source).toContain('<WorkflowFeedbackOverlay');
    expect(source).toContain('autoDismissMs={5000}');
  });

  it('schließt nach exakt fünf Sekunden und räumt den Timer auf', () => {
    const overlaySource = readFileSync('src/components/ui/WorkflowFeedbackOverlay.tsx', 'utf8');
    expect(overlaySource).toContain('const timer = setTimeout(() => {');
    expect(overlaySource).toContain('clearTimeout(timer)');
  });

  it('ersetzt auch im Mitarbeiter-Einsatz die große Erfolgsfläche', () => {
    expect(employeeExecutionSource).toContain('<WorkflowToast');
    expect(employeeExecutionSource).not.toContain('<SuccessState message={localSuccess!}');
  });
});
