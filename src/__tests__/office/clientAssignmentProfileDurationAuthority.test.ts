import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyTaskPackageTasksToAssignmentProfile,
  assignmentProfileEndAt,
} from '@/lib/office/clientAssignmentProfileDuration';
import type { ClientAssignmentProfileInput } from '@/types/modules/clientAssignmentProfile';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

function profileInput(): ClientAssignmentProfileInput {
  return {
    clientId: 'client-1',
    employeeId: 'employee-1',
    profileName: 'Drei Stunden Alltagsbegleitung',
    assignmentTitle: 'Alltagsbegleitung',
    description: '',
    durationMinutes: 180,
    taskTitles: [],
    taskDrafts: [],
    serviceKey: 'assist',
    serviceName: 'Alltagsbegleitung',
    subjectKey: 'alltag',
    assignmentTypeKey: 'regelversorgung',
    serviceCategoryKey: 'assist',
    taskPackageId: null,
    billingBudgetSourceKey: 'entlastungsbetrag',
    riskFlagKeys: [],
    documentationTemplateKey: 'standard',
    proofTemplateKey: 'einzel',
    catalogSnapshotJson: {},
    locationAddress: '',
    locationNotes: '',
    notesForEmployee: '',
    internalNotes: '',
    clientVisibleNotes: '',
    billingRelevant: true,
    requiresSignature: true,
    requiresDocumentation: true,
    requiresRoute: false,
    clientPortalVisible: true,
    employeePortalVisible: true,
  };
}

describe('Einsatzprofil-Dauer als alleinige Kalenderquelle', () => {
  it('behält 180 Minuten bei, obwohl die Vorlagenaufgabe 120 Minuten vorgibt', () => {
    const result = applyTaskPackageTasksToAssignmentProfile(
      profileInput(),
      'package-120',
      [{
        itemKey: 'haushalt-120',
        title: 'Hauswirtschaftliche Unterstützung',
        isRequired: true,
        isOptional: false,
        sortOrder: 0,
        defaultDurationMinutes: 120,
      }],
    );

    expect(result.durationMinutes).toBe(180);
    expect(result.taskDrafts[0]?.defaultDurationMinutes).toBe(120);
  });

  it('berechnet das Kalenderende ausschließlich aus 180 Minuten Profilzeit', () => {
    const startAt = '2026-08-10T08:00:00.000Z';
    const endAt = assignmentProfileEndAt(startAt, 180);
    expect(endAt).toBe('2026-08-10T11:00:00.000Z');
  });

  it('sichert Zuordnung, Assist-Einsatz und Kalender per Datenbank-Trigger ab', () => {
    const migration = read(
      'supabase/migrations/20260803090000_assignment_profile_duration_authority.sql',
    );
    const panel = read('src/components/office/ClientAssignmentProfilesPanel.tsx');
    const release = read(
      'supabase/migrations/20260730193000_office_assignment_profiles_full_assist_templates.sql',
    );

    expect(migration).toContain('enforce_assignment_profile_duration_on_insert');
    expect(migration).toContain('enforce_assist_profile_duration_on_insert');
    expect(migration).toContain('enforce_calendar_profile_duration_on_insert');
    expect(migration).toContain('make_interval(mins => v_duration_minutes)');
    expect(migration).toContain('jsonb_array_elements(COALESCE(p.task_drafts');
    expect(migration).toContain("a.status::TEXT NOT IN ('cancelled', 'storniert', 'no_show', 'nicht_erschienen', 'completed', 'abgeschlossen')");
    expect(release).toContain('v_profile.duration_minutes');
    expect(panel).not.toContain('selectedPackage?.defaultDurationMinutes ?? current.durationMinutes');
    expect(panel).toContain("durationSource: 'assignment_profile'");
  });
});
