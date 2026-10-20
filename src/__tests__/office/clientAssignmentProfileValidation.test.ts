import { describe, expect, it } from 'vitest';
import {
  validateClientAssignmentProfileInput,
} from '@/lib/office/clientAssignmentProfileService';
import type { ClientAssignmentProfileInput } from '@/types/modules/clientAssignmentProfile';
import {
  calculateAssignmentDragScrollDelta,
} from '@/components/calendar/assignmentProfileDragAutoScroll';

function validInput(): ClientAssignmentProfileInput {
  return {
    clientId: 'client-1',
    employeeId: 'employee-1',
    profileName: 'Haushalt Montag',
    assignmentTitle: 'Betreuungseinsatz',
    description: 'Vollständig konfigurierter Einsatz',
    durationMinutes: 60,
    taskTitles: ['Einkaufen'],
    taskDrafts: [{
      itemKey: 'einkaufen',
      title: 'Einkaufen',
      isRequired: true,
      isOptional: false,
      sortOrder: 0,
    }],
    serviceKey: 'assist-betreuung',
    serviceName: 'Betreuung',
    subjectKey: 'betreuung',
    assignmentTypeKey: 'regelversorgung',
    serviceCategoryKey: 'alltag',
    taskPackageId: null,
    billingBudgetSourceKey: 'entlastungsbetrag',
    riskFlagKeys: ['sturzgefahr'],
    documentationTemplateKey: 'assist-standard',
    proofTemplateKey: 'einzel',
    catalogSnapshotJson: {},
    locationAddress: 'Musterstraße 1',
    locationNotes: '',
    notesForEmployee: '',
    internalNotes: '',
    clientVisibleNotes: '',
    billingRelevant: true,
    requiresSignature: true,
    requiresDocumentation: true,
    requiresRoute: true,
    clientPortalVisible: true,
    employeePortalVisible: true,
  };
}

describe('Einsatzprofil-Pflichtangaben', () => {
  it('akzeptiert ein vollständig ausgefülltes Profil', () => {
    expect(validateClientAssignmentProfileInput(validInput())).toBeNull();
  });

  it('weist leeren Profilnamen, fehlende Mitarbeitende und leere Aufgaben eindeutig zurück', () => {
    expect(
      validateClientAssignmentProfileInput({ ...validInput(), profileName: ' ' }),
    ).toBe('Profilname ist erforderlich.');
    expect(
      validateClientAssignmentProfileInput({ ...validInput(), employeeId: null }),
    ).toBe('Mitarbeitende Person ist erforderlich.');
    expect(
      validateClientAssignmentProfileInput({ ...validInput(), taskTitles: ['  '], taskDrafts: [] }),
    ).toBe('Mindestens eine Aufgabe ist erforderlich.');
  });
});

describe('Drag-and-drop Auto-Scroll', () => {
  it('scrollt am oberen Rand nach oben und am unteren Rand nach unten', () => {
    expect(calculateAssignmentDragScrollDelta(5, 0, 800)).toBeLessThan(0);
    expect(calculateAssignmentDragScrollDelta(795, 0, 800)).toBeGreaterThan(0);
  });

  it('scrollt in der sicheren Mitte nicht ungewollt', () => {
    expect(calculateAssignmentDragScrollDelta(400, 0, 800)).toBe(0);
  });
});
