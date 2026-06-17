import type { ClientDetail } from '@/types/detail';
import type { ClientFullDetail } from '@/types/modules/client';
import { splitStreetLine } from '@/lib/clients/clientEditAddressUtils';
import {
  buildStreetLine,
  mapClientEditRawFields,
  mapClientToEditForm,
} from '@/lib/clients/clientEditFormMappers';

function baseDetail(): ClientDetail {
  return {
    id: 'client-1',
    tenantId: 'tenant-1',
    firstName: 'Heinz-Peter',
    lastName: 'Reinhardt',
    status: 'aktiv',
    careLevel: 'pg3',
    city: 'Berlin',
    zip: '10115',
    street: 'Musterstraße 12',
    phone: '030123456',
    email: 'heinz@example.de',
    notes: 'Interne Notiz',
    dateOfBirth: '1948-03-15',
    costCarrier: 'AOK',
    insuranceNumber: 'V123',
    primaryContactPhone: '030123456',
    sensitivity: 'care',
    visibility: 'team',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    contacts: [],
    consents: [],
    auditEntries: [],
    history: [],
    contextCounts: { assignments: 0, documents: 0, invoices: 0, appointments: 0 },
    nextActionHint: '',
    allowedStatusActions: [],
  };
}

function baseFullClient(detail: ClientDetail): ClientFullDetail {
  return {
    ...detail,
    lifecycleStatus: 'aktiv',
    core: {
      id: detail.id,
      tenantId: detail.tenantId,
      firstName: detail.firstName,
      lastName: detail.lastName,
      salutation: 'herr',
      gender: 'männlich',
      dateOfBirth: detail.dateOfBirth,
      lifecycleStatus: 'aktiv',
      insuranceNumber: detail.insuranceNumber,
      keySafeCode: null,
      diagnoses: ['Demenz'],
      primaryContactPhone: detail.primaryContactPhone,
      city: detail.city,
      zip: detail.zip,
      sensitivity: detail.sensitivity,
      visibility: detail.visibility,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    },
    addresses: [{
      id: 'addr-1',
      tenantId: detail.tenantId,
      clientId: detail.id,
      addressType: 'hauptwohnsitz',
      street: 'Musterstraße 12',
      zip: '10115',
      city: 'Berlin',
      country: 'DE',
      isPrimary: true,
      accessNotes: 'Hintereingang',
      floor: '2',
      apartmentNumber: '12',
      doorCode: '4711',
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }],
    contacts: [{
      id: 'contact-em',
      tenantId: detail.tenantId,
      clientId: detail.id,
      firstName: 'Maria',
      lastName: 'Reinhardt',
      relationship: 'angehoerige',
      relationshipLabel: 'Notfallkontakt',
      phone: '0170123456',
      email: null,
      isEmergency: true,
      isPortalUser: false,
      portalPermissions: {
        canViewAppointments: false,
        canViewDocuments: false,
        canViewCarePlan: false,
        canSendMessages: false,
        canViewBilling: false,
      },
      notes: null,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }],
    careLevels: [],
    budgets: [],
    billingProfile: {
      id: 'bill-1',
      tenantId: detail.tenantId,
      clientId: detail.id,
      billingType: 'pflegekasse',
      hourlyRateCents: 3800,
      serviceType: 'betreuung',
      invoiceRecipient: null,
      paymentTermsDays: 30,
      costBearerName: 'AOK',
      costBearerReference: null,
      notes: null,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    },
    contracts: [],
    preferences: null,
    schedulingWishes: null,
    risks: [{ id: 'risk-1', tenantId: detail.tenantId, clientId: detail.id, category: 'sturz', level: 'mittel', description: 'Sturzgefahr im Bad', mitigation: null, createdAt: detail.createdAt, updatedAt: detail.updatedAt }],
    emergencyPlan: null,
    consents: [],
    portalAccess: [],
    documents: [],
    tasks: [],
    timeline: [],
    internalNotes: [],
  };
}

describe('clientEditAddressUtils', () => {
  it('splits street and house number', () => {
    expect(splitStreetLine('Musterstraße 12')).toEqual({ street: 'Musterstraße', houseNumber: '12' });
    expect(splitStreetLine('Platz')).toEqual({ street: 'Platz', houseNumber: '' });
  });

  it('builds combined street line', () => {
    expect(buildStreetLine('Musterstraße', '12')).toBe('Musterstraße 12');
  });
});

describe('clientEditFormMappers', () => {
  it('maps raw DB fields', () => {
    expect(mapClientEditRawFields({
      mobile: '0171',
      floor: '3',
      diagnoses_notes: 'Demenz',
      key_management_notes: 'Langsam sprechen',
    })).toMatchObject({
      mobile: '0171',
      floor: '3',
      diagnosesNotes: 'Demenz',
      keyManagementNotes: 'Langsam sprechen',
    });
  });

  it('maps client record into edit form with contacts and address', () => {
    const detail = baseDetail();
    const full = baseFullClient(detail);
    const form = mapClientToEditForm(detail, full, ['ambulatory_care'], {
      mobile: '0171999888',
      houseNumber: '12',
      accessNotes: '',
      floor: '',
      apartmentNumber: '',
      doorbellName: 'Reinhardt',
      diagnosesNotes: '',
      mobilityNotes: 'Rollator',
      visibleNotesForEmployee: 'Türklingel defekt',
      emergencyNotes: '',
      keyManagementNotes: 'Langsam sprechen',
    });

    expect(form.firstName).toBe('Heinz-Peter');
    expect(form.salutation).toBe('herr');
    expect(form.careContexts).toEqual(['ambulatory_care']);
    expect(form.street).toBe('Musterstraße');
    expect(form.houseNumber).toBe('12');
    expect(form.accessNotes).toBe('Hintereingang');
    expect(form.floor).toBe('2');
    expect(form.apartmentNumber).toBe('12');
    expect(form.accessCode).toBe('4711');
    expect(form.bellName).toBe('Reinhardt');
    expect(form.mobile).toBe('0171999888');
    expect(form.emergencyContactName).toBe('Maria Reinhardt');
    expect(form.emergencyContactPhone).toBe('0170123456');
    expect(form.billingType).toBe('pflegekasse');
    expect(form.mobilityNotes).toBe('Rollator');
    expect(form.communicationNotes).toBe('Langsam sprechen');
    expect(form.careAgreementNotes).toBe('Türklingel defekt');
  });
});
