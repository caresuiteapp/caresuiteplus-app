import { describe, expect, it } from 'vitest';
import { resolveClientInsuranceDisplay } from '@/lib/clients/clientInsurancePresentation.web';
import { buildClientRecordOverview, selectNextClientAssignment } from '@/lib/clients/clientRecordOverview.web';
import { helgaSchneiderFull } from '@/data/demo/clients/helga-schneider';
import type { ClientFullDetail } from '@/types/modules/client';
import type { AssignmentListItem } from '@/types/modules/assist';

const now = Date.parse('2026-10-14T10:00:00Z');
const detail = (overrides: Partial<ClientFullDetail> = {}): ClientFullDetail => ({
  ...helgaSchneiderFull, contracts: [], consents: [], documents: [], tasks: [], timeline: [], history: [], ...overrides,
});
const overview = (overrides: Partial<ClientFullDetail> = {}) => buildClientRecordOverview(detail(overrides), ['daily_assistance'], ['uebersicht', 'stammdaten', 'einsaetze', 'dokumente', 'verlauf'], now);
const assignment = (id: string, overrides: Partial<AssignmentListItem> = {}): AssignmentListItem => ({
  id, tenantId: 'tenant', title: 'Hauswirtschaft', scheduledStart: '2026-10-14T11:00:00Z', scheduledEnd: '2026-10-14T13:00:00Z', status: 'geplant', location: '', clientName: 'Klientin', employeeName: 'Mitarbeitende', employeeId: 'employee', updatedAt: '2026-10-14T09:00:00Z', ...overrides,
});

describe('client overview describes recorded facts accurately', () => {
  it('does not treat active or completed uploaded documents or a consent toggle as signature evidence', () => {
    const document = helgaSchneiderFull.documents[0]!;
    const consent = helgaSchneiderFull.consents[0]!;
    const result = overview({
      documents: [
        { ...document, id: 'active', status: 'aktiv' },
        { ...document, id: 'complete', status: 'abgeschlossen' },
        { ...document, id: 'finalized', intakeStatus: 'finalized' },
      ],
      consents: [{ ...consent, granted: true, grantedAt: '2026-10-13T10:00:00Z', expiresAt: null }],
    });
    expect(result.signedDocuments).toEqual([]);
    expect(result.signedContractCount).toBe(0);
    expect(result.documentCount).toBe(3);
    expect(result.consentGrantedCount).toBe(1);
  });

  it('counts explicit contract signatures once and retains the true total beyond the six-row preview', () => {
    const contract = helgaSchneiderFull.contracts[0]!;
    const contracts = Array.from({ length: 8 }, (_, index) => ({ ...contract, id: `contract-${index}`, documentId: `document-${index}`, signedAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00Z` }));
    const result = overview({ contracts: [...contracts, { ...contracts[0]!, id: 'duplicate' }, { ...contract, id: 'invalid', signedAt: 'invalid' }] });
    expect(result.signedContractCount).toBe(8);
    expect(result.signedDocuments).toHaveLength(6);
    expect(result.signedDocuments[0]?.signedAt).toBe('2026-10-08T10:00:00Z');
  });

  it('does not turn recurring support tasks or declined optional consents into unfinished work', () => {
    const result = overview({ tasks: helgaSchneiderFull.tasks, consents: [{ ...helgaSchneiderFull.consents[0]!, granted: false, grantedAt: null }] });
    expect(result.supportTasks.length).toBeGreaterThan(0);
    expect(result.openItemsCount).toBe(0);
    expect(result.consentGrantedCount).toBe(0);
  });

  it('does not interpret the paused legacy status as an incomplete intake', () => {
    expect(overview({ status: 'in_bearbeitung', lifecycleStatus: 'pausiert' }).openItemsCount).toBe(0);
  });

  it('labels expired consent and unsigned contracts as specific review items', () => {
    const result = overview({
      contracts: [{ ...helgaSchneiderFull.contracts[0]!, signedAt: null, status: 'entwurf' }],
      consents: [{ ...helgaSchneiderFull.consents[0]!, granted: true, expiresAt: '2026-10-13T10:00:00Z' }],
      phone: null, primaryContactPhone: null,
    });
    expect(result.openItemsCount).toBe(3);
    expect(result.openItems.map((item) => item.id)).toEqual(['phone', 'contracts', 'expired-consents']);
    expect(result.consentGrantedCount).toBe(0);
  });

  it('never invents an admission date or an upcoming date from a workflow hint', () => {
    const result = overview({ admissionDate: null, createdAt: '2026-01-01T10:00:00Z', nextActionHint: 'Datenschutz prüfen', contextCounts: { assignments: 10, appointments: 12, documents: 0, invoices: 0 } });
    expect(result.admissionDate).toBe('—');
    expect(result.nextAppointment).toBe('Termine in der Einsatzübersicht prüfen');
    expect(result.nextAppointment).not.toContain('Datenschutz');
  });

  it('finds the latest actual activity without assuming a sorted input', () => {
    const event = helgaSchneiderFull.history[0]!;
    const result = overview({ updatedAt: '2026-01-01T10:00:00Z', history: [{ ...event, id: 'older', timestamp: '2026-10-01T10:00:00Z' }, { ...event, id: 'newer', timestamp: '2026-10-13T10:00:00Z' }] });
    expect(result.recentActivity[0]?.id).toBe('newer');
    expect(result.lastActivity).toContain('13.10.2026');
  });
});

describe('upcoming client assignment selection', () => {
  it('selects the nearest real appointment and ignores cancellations, finished and invalid rows', () => {
    const result = selectNextClientAssignment([
      assignment('cancelled', { assignmentStatus: 'storniert' }),
      assignment('finished', { assignmentStatus: 'beendet' }),
      assignment('actually-ended', { actualEndAt: '2026-10-14T09:00:00Z' }),
      assignment('invalid', { scheduledStart: 'bad' }),
      assignment('later', { scheduledStart: '2026-10-15T11:00:00Z', scheduledEnd: '2026-10-15T13:00:00Z' }),
      assignment('next'),
    ], now);
    expect(result?.id).toBe('next');
  });

  it('retains an ongoing appointment and never shows a past one as upcoming', () => {
    expect(selectNextClientAssignment([assignment('past', { scheduledEnd: '2026-10-14T09:00:00Z' })], now)).toBeNull();
    expect(selectNextClientAssignment([assignment('ongoing', { scheduledStart: '2026-10-14T09:00:00Z' })], now)?.id).toBe('ongoing');
  });
});


describe('web insurance number display', () => {
  it('shows the stored number in the overview only with sensitive-data permission', () => {
    const client = detail({ insuranceNumber: 'LEGACY-100', core: { ...helgaSchneiderFull.core, insuranceNumber: ' A123456789 ' } });
    expect(buildClientRecordOverview(client, [], [], now, true).insuranceNumber).toBe('A123456789');
    expect(buildClientRecordOverview(client, [], [], now, false).insuranceNumber).toBe('••• Geschützt');
    expect(buildClientRecordOverview(client, [], [], now).insuranceNumber).toBe('••• Geschützt');
  });

  it('keeps a masked core number masked even when an unmasked legacy value is present', () => {
    const client = { core: { insuranceNumber: '•••••••••' }, insuranceNumber: 'DO-NOT-REVEAL-100' };
    expect(resolveClientInsuranceDisplay(client, false)).toBe('••• Geschützt');
    expect(resolveClientInsuranceDisplay(client, true)).toBe('••• Geschützt');
  });

  it('uses the stored legacy field only when core is empty and access is permitted', () => {
    const client = { core: { insuranceNumber: null }, insuranceNumber: ' B987654321 ' };
    expect(resolveClientInsuranceDisplay(client, true)).toBe('B987654321');
    expect(resolveClientInsuranceDisplay(client, false)).toBe('••• Geschützt');
  });

  it('labels a missing number instead of substituting a billing reference or historical fund membership', () => {
    const client = detail({ insuranceNumber: null, core: { ...helgaSchneiderFull.core, insuranceNumber: null }, billingProfile: { ...helgaSchneiderFull.billingProfile!, costBearerReference: 'BILLING-REFERENCE' } });
    expect(client.careLevels[0]?.careFundMemberId).toBeTruthy();
    expect(buildClientRecordOverview(client, [], [], now, true).insuranceNumber).toBe('Nicht hinterlegt');
    expect(resolveClientInsuranceDisplay(client, false)).toBe('Nicht hinterlegt');
  });
});
