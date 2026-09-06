import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildVisitProgress } from '@/lib/portal/visitProgress';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit step order R10.5', () => {
  it('never exposes signature capture before the service has ended', () => {
    const uiState = read('src/lib/portal/resolveVisitExecutionUiState.ts');
    const actions = read('src/features/assistWorkflow/resolveAllowedActions.ts');
    expect(uiState).toMatch(/const showSignature =[\s\S]*postServiceReady[\s\S]*documentationSubmitted/);
    expect(actions).toMatch(/detail\.requiresSignature &&[\s\S]*serviceEnded &&[\s\S]*docSubmitted/);
  });

  it('guides a live documented visit to service end instead of signature', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain("if (phase === 'live' && documentationSubmitted)");
    expect(screen).toContain('Erst danach wird die Unterschrift freigeschaltet.');
    expect(screen).toContain("primaryActionResolved === 'end_service'");
    expect(screen).toContain("? 'Einsatz beenden'");
    expect(screen).toContain('? () => void handlePrimary()');
  });

  it('advances to signature only after service end and documentation', () => {
    const input = { status: 'gestartet' as const, serviceEnded: false, documentationComplete: true, requiresSignature: true, signatureCaptured: false };
    const live = buildVisitProgress(input);
    expect(live.steps[live.current].label).toBe('Einsatz');
    const missingDoc = buildVisitProgress({ ...input, serviceEnded: true, documentationComplete: false });
    expect(missingDoc.steps[missingDoc.current].label).toBe('Doku');
    const ended = buildVisitProgress({ ...input, serviceEnded: true });
    expect(ended.steps[ended.current].label).toBe('Unterschrift');
    const signed = buildVisitProgress({ ...input, serviceEnded: true, signatureCaptured: true });
    expect(signed.steps[signed.current].label).toBe('Abschluss');
  });

  it('allows the signature instruction only after the canonical end condition', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain(
      'if (isServiceEnded && showSignature && !signatureCaptured && !signatureDeferred)',
    );
  });
});
