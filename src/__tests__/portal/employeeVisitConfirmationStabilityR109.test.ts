import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit confirmation stability R10.9', () => {
  it('keeps the signature in a calm pending state until server readback confirms it', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    // The bounded poller now owns cadence and deadline; its behavior is
    // exercised by signatureConfirmationPolling.test rather than duplicated.
    expect(screen).toContain('return pollSignatureConfirmation({');
    expect(screen).toContain('onUnconfirmed: () => setSignatureConfirmationStalled(true)');
    expect(screen).toMatch(
      /if \(r\.ok\) \{[\s\S]*signatureConfirmationPending: true,[\s\S]*awaitingSignature: true/,
    );
    expect(screen).not.toMatch(
      /if \(r\.ok\) \{\s*setSignatureConfirmationPending\(false\)/,
    );
  });

  it('does not present transient readback failures as a signature error', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('if (signatureConfirmationPending)');
    expect(screen).toContain("tone: 'info' as const");
    expect(screen).toContain('Unterschrift wird gerade geprüft – bitte warten');
    expect(screen).toContain('const syncWarning = !queryError && (!signatureConfirmationPending || signatureConfirmationStalled)');
  });

  it('makes completed state authoritative over stale synchronization warnings', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("(!signatureConfirmationPending || signatureConfirmationStalled) && phase !== 'completed'");
    const completedGuide = screen.indexOf("if (phase === 'completed')");
    const blockingError = screen.indexOf('const blockingError = localError ?? taskSaveError');
    expect(completedGuide).toBeGreaterThan(-1);
    expect(completedGuide).toBeLessThan(blockingError);
    expect(screen).toContain('setLocalWarning(null);');
  });
});
