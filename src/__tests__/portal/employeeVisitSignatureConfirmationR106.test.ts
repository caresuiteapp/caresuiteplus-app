import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit signature confirmation R10.6', () => {
  it('uses a dedicated persisted confirmation state after signature submission', () => {
    const persistence = read('src/lib/portal/visitWorkflowPersistence.ts');
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(persistence).toContain('signatureConfirmationPending?: boolean');
    expect(screen).toContain('setSignatureConfirmationPending(true)');
    expect(screen).toContain('signatureConfirmationPending: true');
  });

  it('shows an unambiguous waiting label and locks repeat capture', () => {
    const dashboard = read('src/components/portal/EmployeePortalVisitLiveDashboard.tsx');
    expect(dashboard).toContain('Unterschrift wird gerade geprüft – bitte warten');
    expect(dashboard).toContain('Der Serverabgleich läuft automatisch. Bitte nicht erneut tippen.');
    expect(dashboard).toContain('onPress={signatureConfirmationPending ? undefined : onOpenSignature}');
    expect(dashboard).toContain('disabled={signatureConfirmationPending || !signatureEnabled}');
  });

  it('never presents a confirmation timeout as a signature error', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toMatch(
      /else if \(isWorkflowConfirmationPending\(r\.errorCode\)\)[\s\S]*return \{ ok: true as const \}/,
    );
    expect(screen).toMatch(
      /if \(signatureConfirmationPending\)[\s\S]*tone: 'info' as const[\s\S]*Unterschrift wird gerade geprüft/,
    );
  });

  it('suppresses transient sync warnings while the signature readback is pending', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const syncWarning = !queryError && !signatureConfirmationPending');
    expect(screen).toContain('!signatureConfirmationPending &&');
  });

  it('polls automatically and advances only after authoritative confirmation', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('await signatureConfirmationRefreshRef.current()');
    expect(screen).toContain('attempts < 3');
    expect(screen).not.toContain('const poll = setInterval');
    expect(screen).toContain('Unterschrift geprüft und gespeichert');
    expect(screen).toContain("signatureConfirmationPending ? 'UNTERSCHRIFT WIRD GEPRÜFT'");
  });
});
