import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  addServiceProofDeployment,
  attemptEditContract,
  attemptEditServiceProof,
  confirmContractPreview,
  confirmDocumentationPreview,
  confirmServiceProofPreview,
  createContractDraft,
  createDocumentationDraft,
  createServiceProofDraft,
  finalizeContract,
  finalizeDocumentation,
  getContract,
  getContractAuditTrail,
  getDocumentation,
  getDocumentationAuditTrail,
  getServiceProof,
  getServiceProofAuditTrail,
  getServiceProofPdfState,
  patchContractForTest,
  patchDocumentationForTest,
  patchServiceProofForTest,
  recalculateMonthlyProofTotals,
  resetContractDocumentStore,
  resetDocumentationDocumentStore,
  resetLifecycleDocumentStore,
  resetServiceProofDocumentStore,
  signAndFinalizeServiceProof,
  validateContractForFinalization,
  validateDocumentationForFinalization,
  validateServiceProofForFinalization,
} from '@/lib/documents';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = 'tenant-other-999';
const ADMIN = 'business_admin' as const;

describe('contract, service proof & documentation module', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetContractDocumentStore();
    resetServiceProofDocumentStore();
    resetDocumentationDocumentStore();
    resetLifecycleDocumentStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetContractDocumentStore();
    resetServiceProofDocumentStore();
    resetDocumentationDocumentStore();
    resetLifecycleDocumentStore();
  });

  it('Vertrag ohne Parteien blockiert', () => {
    const ctr = createContractDraft({ tenantId: TENANT, contractType: 'kundenvertrag' });
    patchContractForTest({
      ...ctr,
      partyA: { ...ctr.partyA, name: '' },
      partyB: { ...ctr.partyB, name: '' },
      contractNumber: 'V-2026-0001',
      previewConfirmed: true,
    });

    const result = validateContractForFinalization(TENANT, ctr.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.status).toBe('error');
      expect(result.data.validation.issues.some((i) => i.code === 'parties_missing')).toBe(true);
    }
  });

  it('Vertrag ohne Vergütung blockiert wenn erforderlich', () => {
    const ctr = createContractDraft({ tenantId: TENANT, contractType: 'kundenvertrag' });
    patchContractForTest({
      ...ctr,
      compensation: '',
      hourlyRate: '',
      contractNumber: 'V-2026-0002',
      previewConfirmed: true,
    });

    const result = validateContractForFinalization(TENANT, ctr.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'compensation_missing')).toBe(true);
    }
  });

  it('Leistungsnachweis ohne Klient blockiert', () => {
    const proof = createServiceProofDraft({ tenantId: TENANT, proofType: 'einzel_einsatznachweis' });
    patchServiceProofForTest({
      ...proof,
      clientName: '',
      previewConfirmed: true,
      proofNumber: 'LN-2026-0001',
    });

    const result = validateServiceProofForFinalization(TENANT, proof.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'client_missing')).toBe(true);
    }
  });

  it('Leistungsnachweis ohne Zeiten blockiert', () => {
    const proof = createServiceProofDraft({ tenantId: TENANT, proofType: 'einzel_einsatznachweis' });
    patchServiceProofForTest({
      ...proof,
      startTime: '',
      endTime: '',
      durationMinutes: 0,
      previewConfirmed: true,
      proofNumber: 'LN-2026-0002',
    });

    const result = validateServiceProofForFinalization(TENANT, proof.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'times_missing')).toBe(true);
    }
  });

  it('Leistungsnachweis nach Signatur gesperrt', async () => {
    const proof = createServiceProofDraft({ tenantId: TENANT, proofType: 'einzel_einsatznachweis' });
    await confirmServiceProofPreview(TENANT, proof.id, ADMIN);

    const finalized = await signAndFinalizeServiceProof(
      TENANT,
      proof.id,
      { clientSignature: true },
      ADMIN,
    );
    expect(finalized.ok).toBe(true);
    if (finalized.ok) {
      expect(finalized.data.lockedAt).toBeTruthy();
      expect(finalized.data.status).toBe('finalized');
      expect(finalized.data.contentHash).toBeTruthy();
    }

    const edit = await attemptEditServiceProof(TENANT, proof.id, ADMIN);
    expect(edit.ok).toBe(false);
  });

  it('Monatsnachweis summiert Einsätze korrekt', () => {
    const proof = createServiceProofDraft({ tenantId: TENANT, proofType: 'monatsnachweis' });
    addServiceProofDeployment(TENANT, proof.id, {
      deploymentDate: '2026-06-02',
      startTime: '08:00',
      endTime: '10:00',
    });
    addServiceProofDeployment(TENANT, proof.id, {
      deploymentDate: '2026-06-10',
      startTime: '14:00',
      endTime: '16:30',
    });

    const recalc = recalculateMonthlyProofTotals(TENANT, proof.id);
    expect(recalc.ok).toBe(true);
    if (recalc.ok) {
      // Initial 90min + 120min + 150min = 360min = 6h
      expect(recalc.data.totalHours).toBe(6);
      expect(recalc.data.deployments.length).toBe(3);
    }
  });

  it('Dokumentation ohne Text blockiert', () => {
    const doc = createDocumentationDraft({ tenantId: TENANT, documentationType: 'einsatzdokumentation' });
    patchDocumentationForTest({
      ...doc,
      contentText: '',
      observation: '',
      measure: '',
      documentNumber: 'DOC-2026-0001',
      previewConfirmed: true,
    });

    const result = validateDocumentationForFinalization(TENANT, doc.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'documentation_text_missing')).toBe(true);
    }
  });

  it('Notfallprotokoll erfordert Anlass und Beschreibung', () => {
    const doc = createDocumentationDraft({ tenantId: TENANT, documentationType: 'notfallprotokoll' });
    patchDocumentationForTest({
      ...doc,
      occasion: '',
      observation: '',
      contentText: '',
      documentNumber: 'DOC-2026-0002',
      previewConfirmed: true,
    });

    const result = validateDocumentationForFinalization(TENANT, doc.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'occasion_missing')).toBe(true);
      expect(result.data.validation.issues.some((i) => i.code === 'description_missing')).toBe(true);
    }
  });

  it('Audit-Events werden erstellt', async () => {
    const ctr = createContractDraft({ tenantId: TENANT, contractType: 'vollmacht' });
    await confirmContractPreview(TENANT, ctr.id, ADMIN);
    patchContractForTest({ ...getContract(TENANT, ctr.id)!, contractNumber: 'V-2026-0099' });
    await finalizeContract(TENANT, ctr.id, ADMIN);

    const audit = getContractAuditTrail(TENANT, ctr.id);
    expect(audit.some((e) => e.eventType === 'contract_created')).toBe(true);
    expect(audit.some((e) => e.eventType === 'contract_finalized')).toBe(true);
    expect(audit.some((e) => e.eventType === 'contract_locked')).toBe(true);

    const proof = createServiceProofDraft({ tenantId: TENANT, proofType: 'einzel_einsatznachweis' });
    await confirmServiceProofPreview(TENANT, proof.id, ADMIN);
    await signAndFinalizeServiceProof(TENANT, proof.id, { clientSignature: true }, ADMIN);
    const proofAudit = getServiceProofAuditTrail(TENANT, proof.id);
    expect(proofAudit.some((e) => e.eventType === 'service_proof_signed')).toBe(true);
    expect(proofAudit.some((e) => e.eventType === 'service_proof_locked')).toBe(true);

    const careDoc = createDocumentationDraft({ tenantId: TENANT, documentationType: 'betreuung' });
    await confirmDocumentationPreview(TENANT, careDoc.id, ADMIN);
    await finalizeDocumentation(TENANT, careDoc.id, ADMIN);
    const docAudit = getDocumentationAuditTrail(TENANT, careDoc.id);
    expect(docAudit.some((e) => e.eventType === 'documentation_finalized')).toBe(true);
  });

  it('Mandantenisolation', async () => {
    const ctr = createContractDraft({ tenantId: TENANT, contractType: 'kundenvertrag' });
    expect(getContract(OTHER_TENANT, ctr.id)).toBeUndefined();

    await confirmContractPreview(TENANT, ctr.id, ADMIN);
    patchContractForTest({ ...getContract(TENANT, ctr.id)!, contractNumber: 'V-2026-0100' });
    await finalizeContract(TENANT, ctr.id, ADMIN);

    const editOther = await attemptEditContract(OTHER_TENANT, ctr.id, ADMIN);
    expect(editOther.ok).toBe(false);
    if (!editOther.ok) {
      expect(editOther.error).toContain('nicht gefunden');
    }
  });

  it('PDF-Produktion nicht verfügbar — Disclaimer', () => {
    const state = getServiceProofPdfState();
    expect(state.isPdfProductionAvailable).toBe(false);
    expect(state.disclaimer).toContain('vorbereitet');
  });
});
