import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  addConsultationRecommendation,
  assertProductionNoDemoFallback,
  canViewConsultationHealthData,
  createConsultationCase,
  createConsultationFollowUp,
  createConsultationProtocol,
  createConsultationProtocolVersion,
  finalizeConsultationProtocol,
  filterConsultationCasesForActor,
  getConsultationAuditEventsForCase,
  listConsultationCases,
  listConsultationProtocolVersions,
  maskHealthDataField,
  prepareConsultationBilling,
  resetConsultationStore,
  saveConsultationAssessment,
  signConsultationDocument,
  updateConsultationCaseStatus,
} from '@/lib/consultation';
import { getConsultationStore } from '@/lib/consultation/consultationStore';
import { CONSULTATION_LEGAL_DISCLAIMER } from '@/types/modules/consultation';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = '00000000-0000-4000-8000-000000000099';
const CLIENT = 'client-001';
const COUNSELOR = 'counselor';

describe('CareSuite+ Beratung (Consultation Module)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetConsultationStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetConsultationStore();
  });

  it('1. erstellt Beratungsfall mit tenant_id und Beratungsanlass', () => {
    const result = createConsultationCase({
      tenantId: TENANT_A,
      clientId: CLIENT,
      title: 'Pflegeberatung Müller',
      occasionKey: 'pflegeberatung_37_3',
      actorRoleKey: COUNSELOR,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantId).toBe(TENANT_A);
      expect(result.data.occasionKey).toBe('pflegeberatung_37_3');
      expect(result.data.status).toBe('draft');
    }
  });

  it('2. Mandantentrennung — fremde Mandanten unsichtbar', () => {
    const now = new Date().toISOString();
    getConsultationStore(TENANT_A).cases.push({
      id: 'case-a',
      tenantId: TENANT_A,
      clientId: CLIENT,
      assignedProfileId: null,
      occasionKey: 'allgemein',
      title: 'Fall A',
      status: 'draft',
      scheduledAt: null,
      completedAt: null,
      containsHealthData: false,
      billingPreparedAt: null,
      legalDisclaimerAcknowledged: false,
      createdAt: now,
      updatedAt: now,
    });
    getConsultationStore(TENANT_B).cases.push({
      id: 'case-b',
      tenantId: TENANT_B,
      clientId: CLIENT,
      assignedProfileId: null,
      occasionKey: 'allgemein',
      title: 'Fall B',
      status: 'draft',
      scheduledAt: null,
      completedAt: null,
      containsHealthData: false,
      billingPreparedAt: null,
      legalDisclaimerAcknowledged: false,
      createdAt: now,
      updatedAt: now,
    });

    const filtered = filterConsultationCasesForActor(
      [...getConsultationStore(TENANT_A).cases, ...getConsultationStore(TENANT_B).cases],
      { actorRole: COUNSELOR, tenantId: TENANT_A },
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tenantId).toBe(TENANT_A);

    const listA = listConsultationCases(TENANT_A, COUNSELOR);
    expect(listA.ok).toBe(true);
    if (listA.ok) expect(listA.data).toHaveLength(1);
  });

  it('3. Gesundheitsdaten nur mit view_sensitive sichtbar', () => {
    expect(
      canViewConsultationHealthData({
        actorRole: 'family_portal',
        tenantId: TENANT_A,
        resource: { tenantId: TENANT_A, containsHealthData: true },
      }).allowed,
    ).toBe(false);

    expect(
      canViewConsultationHealthData({
        actorRole: 'business_admin',
        tenantId: TENANT_A,
        resource: { tenantId: TENANT_A, containsHealthData: true },
      }).allowed,
    ).toBe(true);

    expect(
      maskHealthDataField('Pflegebedarf Details', {
        actorRole: 'family_portal',
        tenantId: TENANT_A,
        containsHealthData: true,
      }),
    ).toBeNull();

    expect(
      maskHealthDataField('Pflegebedarf Details', {
        actorRole: 'business_admin',
        tenantId: TENANT_A,
        containsHealthData: true,
      }),
    ).toBe('Pflegebedarf Details');
  });

  it('4. Protokoll-Versionierung mit Audit-Trail', () => {
    const created = createConsultationCase({
      tenantId: TENANT_A,
      clientId: CLIENT,
      title: 'Protokoll-Fall',
      occasionKey: 'pflegeberatung_37_3',
      actorRoleKey: COUNSELOR,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const protocol = createConsultationProtocol({
      tenantId: TENANT_A,
      caseId: created.data.id,
      title: 'Beratungsprotokoll',
      content: 'Erstfassung',
      actorRoleKey: COUNSELOR,
    });
    expect(protocol.ok).toBe(true);
    if (!protocol.ok) return;

    const v2 = createConsultationProtocolVersion({
      tenantId: TENANT_A,
      documentId: protocol.data.id,
      content: 'Korrigierte Fassung',
      changeReason: 'Ergänzung',
      actorRoleKey: COUNSELOR,
    });
    expect(v2.ok).toBe(true);
    if (v2.ok) expect(v2.data.document.currentVersion).toBe(2);

    const versions = listConsultationProtocolVersions(TENANT_A, protocol.data.id, COUNSELOR);
    expect(versions.ok).toBe(true);
    if (versions.ok) expect(versions.data).toHaveLength(2);

    const audit = getConsultationAuditEventsForCase(TENANT_A, created.data.id, COUNSELOR);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.eventType === 'protocol_version_created')).toBe(true);
    }
  });

  it('5. Abrechnungsvorbereitung blockiert ohne Pflegegrad, Protokoll und Unterschrift', () => {
    const created = createConsultationCase({
      tenantId: TENANT_A,
      clientId: CLIENT,
      title: 'Abrechnungs-Fall',
      occasionKey: 'pflegeberatung_37_3',
      actorRoleKey: COUNSELOR,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const blocked = prepareConsultationBilling({
      tenantId: TENANT_A,
      caseId: created.data.id,
      actorRoleKey: COUNSELOR,
    });
    expect(blocked.ok).toBe(true);
    if (blocked.ok) {
      expect(blocked.data.passed).toBe(false);
      expect(blocked.data.checks.some((c) => c.checkKey === 'pflegegrad' && c.status === 'failed')).toBe(true);
    }

    saveConsultationAssessment({
      tenantId: TENANT_A,
      caseId: created.data.id,
      careGrade: 'pg2',
      actorRoleKey: COUNSELOR,
    });

    const protocol = createConsultationProtocol({
      tenantId: TENANT_A,
      caseId: created.data.id,
      title: 'Protokoll',
      content: 'Inhalt',
      actorRoleKey: COUNSELOR,
    });
    expect(protocol.ok).toBe(true);
    if (!protocol.ok) return;

    finalizeConsultationProtocol({
      tenantId: TENANT_A,
      documentId: protocol.data.id,
      actorRoleKey: COUNSELOR,
    });

    signConsultationDocument({
      tenantId: TENANT_A,
      documentId: protocol.data.id,
      signedByProfileId: 'profile-1',
      actorRoleKey: COUNSELOR,
    });

    const ready = prepareConsultationBilling({
      tenantId: TENANT_A,
      caseId: created.data.id,
      durationMinutes: 60,
      costCarrierProfileId: 'cc-1',
      actorRoleKey: COUNSELOR,
    });
    expect(ready.ok).toBe(true);
    if (ready.ok) {
      expect(ready.data.passed).toBe(true);
    }
  });

  it('6. Maßnahmenempfehlung trägt Rechts-/Medizinhinweis', () => {
    const created = createConsultationCase({
      tenantId: TENANT_A,
      clientId: CLIENT,
      title: 'Maßnahmen-Fall',
      occasionKey: 'massnahmenplanung',
      actorRoleKey: COUNSELOR,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rec = addConsultationRecommendation({
      tenantId: TENANT_A,
      caseId: created.data.id,
      title: 'Tagespflege prüfen',
      description: 'Option zur Entlastung.',
      actorRoleKey: COUNSELOR,
    });
    expect(rec.ok).toBe(true);
    if (rec.ok) {
      expect(rec.data.isInformationalOnly).toBe(true);
      expect(rec.data.description).toContain(CONSULTATION_LEGAL_DISCLAIMER);
    }
  });

  it('7. Production-Modus blockiert Demo-Fallback', () => {
    const blocked = assertProductionNoDemoFallback(true);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toMatch(/Production Mode/);
    }

    const allowed = assertProductionNoDemoFallback(false);
    expect(allowed.allowed).toBe(true);
  });

  it('8. Status-Workflow: Abschluss nur mit Unterschrift', () => {
    const created = createConsultationCase({
      tenantId: TENANT_A,
      clientId: CLIENT,
      title: 'Workflow-Fall',
      occasionKey: 'pflegeberatung_37_3',
      actorRoleKey: COUNSELOR,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    updateConsultationCaseStatus({
      tenantId: TENANT_A,
      caseId: created.data.id,
      newStatus: 'in_progress',
      actorRoleKey: COUNSELOR,
    });
    updateConsultationCaseStatus({
      tenantId: TENANT_A,
      caseId: created.data.id,
      newStatus: 'documentation_pending',
      actorRoleKey: COUNSELOR,
    });
    updateConsultationCaseStatus({
      tenantId: TENANT_A,
      caseId: created.data.id,
      newStatus: 'signature_pending',
      actorRoleKey: COUNSELOR,
    });

    const blockedComplete = updateConsultationCaseStatus({
      tenantId: TENANT_A,
      caseId: created.data.id,
      newStatus: 'completed',
      hasSignature: false,
      actorRoleKey: COUNSELOR,
    });
    expect(blockedComplete.ok).toBe(false);

    const completed = updateConsultationCaseStatus({
      tenantId: TENANT_A,
      caseId: created.data.id,
      newStatus: 'completed',
      hasSignature: true,
      actorRoleKey: COUNSELOR,
    });
    expect(completed.ok).toBe(true);
    if (completed.ok) expect(completed.data.status).toBe('completed');

    const followUp = createConsultationFollowUp({
      tenantId: TENANT_A,
      caseId: created.data.id,
      dueAt: '2026-07-01T10:00:00.000Z',
      note: 'Nachkontrolle',
      actorRoleKey: COUNSELOR,
    });
    expect(followUp.ok).toBe(true);
  });
});
