import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WorkflowFeedbackOverlay', () => {
  const source = readFileSync('src/components/ui/WorkflowFeedbackOverlay.tsx', 'utf8');
  const payroll = readFileSync('src/screens/portal/EmployeePayrollMonthScreen.tsx', 'utf8');

  it('wird plattformübergreifend in einer modalen Viewport-Ebene gerendert', () => {
    expect(source).toContain('<Modal');
    expect(source).toContain('visible={visible}');
    expect(source).toContain('presentationStyle="overFullScreen"');
    expect(source).toContain('transparent');
    expect(source).not.toContain('createPortal');
    expect(source).not.toContain('portalHost');
  });

  it('zeigt laufende Vorgänge mit dem CareSuite-Ladeindikator', () => {
    expect(source).toContain('<CareSuiteLoadingIndicator');
    expect(source).toContain('CareSuite lädt');
    expect(source).toContain('Bitte warten und diese Seite nicht schließen.');
    expect(source).toContain('setMessageVisible(false)');
  });

  it('migriert Upload, Speichern, Fehler und Erfolg im Auslagenablauf', () => {
    expect(payroll).toContain('<WorkflowFeedbackOverlay');
    expect(payroll).toContain("setBusyMessage('Beleg wird sicher hochgeladen…')");
    expect(payroll).toContain("kind: 'error'");
    expect(payroll).toContain("kind: 'success'");
    expect(payroll).not.toContain('{message ? <InfoBanner message={message} /> : null}');
  });
});
