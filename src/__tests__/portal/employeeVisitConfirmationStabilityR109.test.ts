import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit confirmation stability R10.9', () => {
  it('keeps the signature in a calm pending state until server readback confirms it', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const retryDelayMs = attempts < 5');
    expect(screen).toContain('attempts < 5 ? 1_500 : attempts < 15 ? 3_000 : 5_000');
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
    expect(screen).toContain('const syncWarning = !queryError && !signatureConfirmationPending');
  });

  it('makes completed state authoritative over stale synchronization warnings', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("!signatureConfirmationPending && phase !== 'completed'");
    const completedGuide = screen.indexOf("if (phase === 'completed')");
    const blockingError = screen.indexOf('const blockingError = localError ?? taskSaveError');
    expect(completedGuide).toBeGreaterThan(-1);
    expect(completedGuide).toBeLessThan(blockingError);
    expect(screen).toContain('setLocalWarning(null);');
  });
});
