import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

  it('keeps the robot at documentation until service end and then advances to signature', () => {
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    expect(progress).toContain('serviceEnded?: boolean');
    expect(progress).toContain("step.key === 'documentation' && documentationComplete && !serviceEnded");
    expect(progress).toContain('(serviceEnded && documentationComplete)');
    expect(progress).toContain('(!requiresSignature || signatureCaptured)');
    expect(header).toContain('serviceEnded={serviceEnded}');
  });

  it('allows the signature instruction only after the canonical end condition', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain(
      'if (isServiceEnded && showSignature && !signatureCaptured && !signatureDeferred)',
    );
  });
});
