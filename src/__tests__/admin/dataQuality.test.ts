import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { listManagementTasks } from '@/lib/assist/managementTaskService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import {
  buildDataQualityOverview,
  createManagementTaskForBlockingIssue,
  fetchDataQualityOverview,
  resetDataQualityStore,
  upsertAssignmentMasterData,
  upsertClientMasterData,
  upsertEmployeeMasterData,
  upsertInvoiceMasterData,
  upsertServiceRecordMasterData,
  upsertTenantMasterDataProfile,
  validateAssignmentData,
  validateBillingReadiness,
  validateClientMasterData,
  validateDocumentReadiness,
  validateEmployeeMasterData,
  validateInvoiceMasterData,
  validatePortalAccess,
  validateServiceRecordData,
  validateTenantMasterData,
} from '@/lib/admin/dataQualityService';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = 'tenant-dq-isolation';

function completeTenant() {
  return {
    tenantId: TENANT_A,
    name: 'CareSuite Test GmbH',
    legalForm: 'GmbH',
    street: 'Teststraße 1',
    zip: '10115',
    city: 'Berlin',
    phone: '+49 30 12345',
    email: 'test@caresuite.app',
    managementName: 'Max Mustermann',
    registerNumber: 'HRB 999',
    taxId: '27/999/000',
    vatId: 'DE999999999',
    ikNumber: '123456789',
    bankName: 'Test Bank',
    iban: 'DE89370400440532013000',
    paymentTermsDays: 14,
    taxStatus: 'regelbesteuert',
    statutoryBillingActive: true,
    invoicesEnabled: true,
  };
}

describe('Stammdatenqualität (Prompt 66)', () => {
  beforeEach(() => {
    resetDataQualityStore();
    resetLiveMonitorStore();
  });

  it('1. Vollständiger Mandant besteht Validierung', () => {
    const result = validateTenantMasterData(completeTenant());
    expect(result.status).toBe('complete');
    expect(result.blockingIssues).toHaveLength(0);
  });

  it('2. Unvollständiger Mandant ohne Name ist blockiert', () => {
    const result = validateTenantMasterData({ ...completeTenant(), name: null });
    expect(result.status).toBe('incomplete');
    expect(result.blockingIssues.some((i) => i.fieldKey === 'tenant.name')).toBe(true);
  });

  it('3. Gesetzliche Abrechnung ohne IK blockiert', () => {
    const result = validateBillingReadiness({
      tenantId: TENANT_A,
      billingCaseId: 'bill-1',
      pflegegrad: 3,
      hasLeistungsnachweis: true,
      hasUnterschrift: true,
      costCarrierId: 'KT-1',
      tenantIkNumber: null,
      statutoryBillingActive: true,
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_ik_data')).toBe(true);
  });

  it('4. Rechnung ohne Bankverbindung blockiert', () => {
    const result = validateInvoiceMasterData({
      tenantId: TENANT_A,
      invoiceId: 'inv-1',
      invoiceNumber: 'RE-001',
      recipientName: 'Maria Muster',
      recipientStreet: 'Weg 1',
      recipientCity: 'Berlin',
      invoiceDate: '2026-06-01',
      servicePeriod: 'Mai 2026',
      lineItemCount: 2,
      netTotalCents: 10000,
      grossTotalCents: 11900,
      taxNote: 'USt 19%',
      paymentTermsDays: 14,
      bankName: null,
      iban: null,
      footerPresent: true,
      status: 'draft',
      pdfRef: null,
      taxLogicValid: true,
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_bank_account')).toBe(true);
  });

  it('5. Klient ohne Adresse blockiert Hausbesuch', () => {
    const result = validateClientMasterData({
      tenantId: TENANT_A,
      clientId: 'client-1',
      firstName: 'Anna',
      lastName: 'Test',
      status: 'active',
      requiresOnSiteAddress: true,
      street: null,
      city: null,
    });
    expect(result.blockingIssues.some((i) => i.fieldKey === 'client.address')).toBe(true);
  });

  it('6. Klient ohne Pflegegrad erzeugt Budget-Warnung', () => {
    const result = validateClientMasterData({
      tenantId: TENANT_A,
      clientId: 'client-2',
      firstName: 'Anna',
      lastName: 'Test',
      status: 'active',
      requiresBudget: true,
      careLevel: null,
      selfPayer: true,
    });
    expect(result.warnings.some((i) => i.type === 'missing_budget')).toBe(true);
  });

  it('7. Pflegekraft ohne Qualifikation blockiert', () => {
    const result = validateEmployeeMasterData({
      tenantId: TENANT_A,
      employeeId: 'emp-1',
      firstName: 'Lisa',
      lastName: 'Pflege',
      roleKey: 'nurse',
      status: 'active',
      email: 'lisa@test.app',
      requiresCareQualification: true,
      qualification: null,
    });
    expect(result.blockingIssues.some((i) => i.fieldKey === 'employee.qualification')).toBe(true);
  });

  it('8. Einsatz ohne Klient/Zeit blockiert Planung', () => {
    const result = validateAssignmentData({
      tenantId: TENANT_A,
      assignmentId: 'asg-1',
      clientId: null,
      assignmentDate: null,
      plannedStartTime: null,
      serviceType: null,
      tasks: [],
    });
    expect(result.blockingIssues.length).toBeGreaterThan(2);
  });

  it('9. Leistungsnachweis ohne Unterschrift blockiert', () => {
    const result = validateServiceRecordData({
      tenantId: TENANT_A,
      serviceRecordId: 'sr-1',
      assignmentId: 'asg-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      startTime: '08:00',
      endTime: '09:00',
      durationMinutes: 60,
      serviceType: 'Grundpflege',
      tasksCompleted: true,
      documentationStatus: 'ok',
      signatureStatus: 'missing',
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_signature')).toBe(true);
  });

  it('10. Rechnung ohne Empfänger blockiert', () => {
    const result = validateInvoiceMasterData({
      tenantId: TENANT_A,
      invoiceId: 'inv-2',
      invoiceNumber: 'RE-002',
      recipientName: null,
      lineItemCount: 0,
      taxLogicValid: false,
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_recipient')).toBe(true);
  });

  it('11. Dokument ohne Pflichtfelder blockiert Finalisierung', () => {
    const result = validateDocumentReadiness({
      tenantId: TENANT_A,
      documentId: 'doc-1',
      templateActive: true,
      requiredFieldsFilled: false,
      previewConfirmed: false,
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_template_data')).toBe(true);
  });

  it('12. Portal ohne Zugangszuweisung blockiert', () => {
    const result = validatePortalAccess({
      tenantId: TENANT_A,
      portalId: 'portal-1',
      portalType: 'client',
      accessAssigned: false,
      privacyCheckDone: false,
    });
    expect(result.blockingIssues.some((i) => i.type === 'missing_permission')).toBe(true);
  });

  it('13. Cross-Tenant-Risiko blockiert und erzeugt Management-Task', () => {
    const result = validateAssignmentData({
      tenantId: TENANT_A,
      assignmentId: 'asg-x',
      clientId: 'client-1',
      assignmentDate: '2026-06-16',
      plannedStartTime: '08:00',
      plannedEndTime: '09:00',
      serviceType: 'Grundpflege',
      tasks: ['Waschen'],
      street: 'Weg 1',
      city: 'Berlin',
      employeeId: 'emp-1',
      contextTenantId: TENANT_B,
    });
    expect(result.status).toBe('blocked');
    createManagementTaskForBlockingIssue(TENANT_A, result);
    const tasks = listManagementTasks(TENANT_A);
    expect(tasks.some((t) => t.taskType === 'master_data_review')).toBe(true);

    upsertClientMasterData(TENANT_A, {
      tenantId: TENANT_A,
      clientId: 'client-blocked',
      firstName: 'X',
      lastName: 'Y',
      status: 'active',
      requiresOnSiteAddress: true,
    });
    const overview = buildDataQualityOverview(TENANT_A);
    expect(overview.tenantId).toBe(TENANT_A);
    expect(fetchDataQualityOverview(TENANT_B).tenantId).toBe(TENANT_B);
    upsertTenantMasterDataProfile(TENANT_B, { tenantId: TENANT_B, name: 'B GmbH' });
    expect(overview.totalBlocking).toBeGreaterThan(0);
  });
});
