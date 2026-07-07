import { describe, expect, it } from 'vitest';
import {
  primaryAllowedAction,
  resolveAllowedActions,
} from '@/features/assistWorkflow/resolveAllowedActions';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

function baseDetail(
  overrides: Partial<AssistExecutionContext['detail']> = {},
): AssistExecutionContext['detail'] {
  return {
    assignmentId: 'a1',
    title: 'Regelmäßige Alltagsbegleitung',
    clientName: 'Heinz-Peter',
    clientId: 'c1',
    locationAddress: 'Musterstraße 1',
    plannedStartAt: '2026-07-01T08:00:00Z',
    plannedEndAt: '2026-07-01T10:00:00Z',
    status: 'dokumentation_offen',
    requiresSignature: true,
    requiresDocumentation: true,
    documentationStatus: 'submitted',
    signatureStatus: 'pending',
    tasks: [],
    allowedTransitions: [],
    isLocked: false,
    ...overrides,
  };
}

describe('resolveAllowedActions — documentation → signature → finalize', () => {
  it('offers capture_signature on beendet after documentation submitted', () => {
    const actions = resolveAllowedActions({
      assignmentStatus: 'beendet',
      visitTimes: { serviceEndedAt: '2026-07-01T10:00:00Z' } as import('@/features/assistWorkflow/calculateVisitTimes').VisitTimesSummary,
      detail: baseDetail({
        status: 'beendet',
        documentationStatus: 'submitted',
        signatureStatus: 'pending',
      }),
      derivedStatus: 'beendet',
    });
    expect(actions).toContain('capture_signature');
    expect(primaryAllowedAction(actions, 'beendet')).toBe('capture_signature');
  });

  it('offers capture_signature after documentation is submitted', () => {
    const actions = resolveAllowedActions({
      assignmentStatus: 'dokumentation_offen',
      visitTimes: null,
      detail: baseDetail(),
      derivedStatus: 'dokumentation_offen',
    });
    expect(actions).toContain('capture_signature');
    expect(primaryAllowedAction(actions, 'dokumentation_offen')).toBe('capture_signature');
  });

  it('offers finalize_visit after signature captured', () => {
    const actions = resolveAllowedActions({
      assignmentStatus: 'unterschrift_offen',
      visitTimes: null,
      detail: baseDetail({
        status: 'unterschrift_offen',
        signatureStatus: 'captured',
      }),
      derivedStatus: 'unterschrift_offen',
    });
    expect(actions).toContain('finalize_visit');
    expect(primaryAllowedAction(actions, 'unterschrift_offen')).toBe('finalize_visit');
  });

  it('offers save_documentation while draft after service ended', () => {
    const actions = resolveAllowedActions({
      assignmentStatus: 'beendet',
      visitTimes: null,
      detail: baseDetail({
        status: 'beendet',
        documentationStatus: 'draft',
        signatureStatus: 'none',
      }),
      derivedStatus: 'beendet',
    });
    expect(actions).toContain('save_documentation');
  });

  it('offers finalize_visit_deferred_signature on unterschrift_offen after documentation', () => {
    const actions = resolveAllowedActions({
      assignmentStatus: 'unterschrift_offen',
      visitTimes: null,
      detail: baseDetail({
        status: 'unterschrift_offen',
        signatureStatus: 'pending',
      }),
      derivedStatus: 'unterschrift_offen',
    });
    expect(actions).toContain('finalize_visit_deferred_signature');
    expect(actions).toContain('capture_signature');
    expect(actions).not.toContain('finalize_visit');
  });
});

describe('employee portal execution screen wiring', () => {
  it('uses signature requirement resolver in live execution service', () => {
    const live = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/lib/portal/employeePortalExecutionLiveService.ts'),
      'utf8',
    );
    expect(live).toContain('resolveEmployeePortalDocumentationFlags');
    expect(live).not.toContain('const requiresSignature = false');
  });

  it('validates persisted signature before live abgeschlossen transition', () => {
    const live = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/lib/portal/employeePortalExecutionLiveService.ts'),
      'utf8',
    );
    expect(live).toContain('hasPortalPersistedClientSignature');
    expect(live).not.toMatch(/hasRequiredSignature:\s*false/);
  });

  it('scrolls to signature panel after documentation save', () => {
    const screen = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain('scrollToSignatureSection');
    expect(screen).toContain('signatureCaptureRequest');
    expect(screen).toContain('showDocumentationForm');
  });
});
