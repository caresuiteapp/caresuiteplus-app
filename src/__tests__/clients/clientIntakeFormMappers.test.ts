import { describe, expect, it } from 'vitest';
import { mapClientEditLoadToIntakeForm } from '@/lib/clients/clientIntakeFormMappers';
import { EMPTY_CLIENT_EDIT_FORM } from '@/types/forms/clientEditForm';
import type { ClientDetail } from '@/types/detail';
import type { ClientFullDetail } from '@/types/modules/client';

function buildDetail(): ClientDetail {
  return {
    id: 'client-1',
    tenantId: 'tenant-1',
    firstName: 'Anna',
    lastName: 'Muster',
    dateOfBirth: '1945-03-12',
    careLevel: 'pg2',
    status: 'aktiv',
    sensitivity: 'standard',
    visibility: 'internal',
    street: 'Hauptstraße 5',
    zip: '10115',
    city: 'Berlin',
    phone: '030123456',
    email: 'anna@example.com',
    notes: 'Besonderheiten',
    insuranceNumber: 'A123',
    costCarrier: 'AOK Pflegekasse',
    primaryContactPhone: '030123456',
    ownedByProfileId: null,
    sharedWithProfileIds: [],
    contacts: [],
    consents: [],
    contextCounts: { assignments: 0, documents: 0, invoices: 0, appointments: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildFull(detail: ClientDetail): ClientFullDetail {
  return {
    ...detail,
    lifecycleStatus: 'aktiv',
    core: {
      id: detail.id,
      tenantId: detail.tenantId,
      firstName: detail.firstName,
      lastName: detail.lastName,
      salutation: 'frau',
      gender: 'weiblich',
      dateOfBirth: detail.dateOfBirth,
      lifecycleStatus: 'aktiv',
      insuranceNumber: detail.insuranceNumber,
      keySafeCode: null,
      diagnoses: [],
      primaryContactPhone: detail.primaryContactPhone,
      city: detail.city,
      zip: detail.zip,
      sensitivity: detail.sensitivity,
      visibility: detail.visibility,
      ownedByProfileId: null,
      sharedWithProfileIds: [],
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    },
    addresses: [{
      id: 'addr-1',
      tenantId: detail.tenantId,
      clientId: detail.id,
      addressType: 'hauptwohnsitz',
      street: 'Hauptstraße 5',
      zip: '10115',
      city: 'Berlin',
      country: 'DE',
      isPrimary: true,
      accessNotes: null,
      floor: null,
      apartmentNumber: null,
      doorCode: null,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }],
    contacts: [],
    careLevels: [{
      id: 'cl-1',
      tenantId: detail.tenantId,
      clientId: detail.id,
      grade: 'pg2',
      validFrom: '2026-01-01',
      validUntil: null,
      careFundName: 'AOK Pflegekasse',
      careFundMemberId: 'A123',
      mdAssessmentDate: null,
      notes: null,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    }],
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
      costBearerName: 'AOK Pflegekasse',
      costBearerReference: null,
      notes: null,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    },
    contracts: [],
    preferences: null,
    risks: [],
    emergencyPlan: null,
    consents: [],
    portalAccess: [],
    documents: [],
    tasks: [],
    timeline: [],
    internalNotes: [],
  };
}

describe('mapClientEditLoadToIntakeForm', () => {
  it('maps core client fields into intake wizard defaults', () => {
    const detail = buildDetail();
    const full = buildFull(detail);
    const editForm = {
      ...EMPTY_CLIENT_EDIT_FORM,
      firstName: detail.firstName,
      lastName: detail.lastName,
      dateOfBirth: detail.dateOfBirth ?? '',
      salutation: 'frau',
      gender: 'weiblich',
      status: detail.status,
      careLevel: 'pg2',
      careContexts: ['daily_assistance'],
      notes: detail.notes ?? '',
      insuranceNumber: 'A123',
      costCarrier: 'AOK Pflegekasse',
      billingType: 'pflegekasse',
      street: 'Hauptstraße',
      houseNumber: '5',
      zip: '10115',
      city: 'Berlin',
      phone: '030123456',
      email: 'anna@example.com',
      portalModules: ['office'],
    };

    const intake = mapClientEditLoadToIntakeForm({
      detail,
      fullClient: full,
      careContexts: ['daily_assistance'],
      form: editForm,
    });

    expect(intake.firstName).toBe('Anna');
    expect(intake.lastName).toBe('Muster');
    expect(intake.careContexts).toEqual(['daily_assistance']);
    expect(intake.street).toBe('Hauptstraße');
    expect(intake.houseNumber).toBe('5');
    expect(intake.careFundName).toBe('AOK Pflegekasse');
    expect(intake.billingTypes).toEqual(['pflegekasse']);
    expect(intake.assignedModules).toEqual(['office']);
    expect(intake.specialNotes).toBe('Besonderheiten');
  });

  it('restores multiple billing types from billing profile notes', () => {
    const detail = buildDetail();
    const full = buildFull(detail);
    full.billingProfile = {
      ...full.billingProfile!,
      billingType: 'kombi',
      notes: 'pflegekasse, umwandlung',
    };

    const intake = mapClientEditLoadToIntakeForm({
      detail,
      fullClient: full,
      careContexts: ['daily_assistance'],
      form: {
        ...EMPTY_CLIENT_EDIT_FORM,
        billingType: 'kombi',
      },
    });

    expect(intake.billingTypes).toEqual(['pflegekasse', 'umwandlung']);
  });

  it('restores multiple home access values from ambulatory details', () => {
    const detail = buildDetail();
    const full = buildFull(detail);

    const intake = mapClientEditLoadToIntakeForm({
      detail,
      fullClient: full,
      careContexts: ['ambulatory_care'],
      form: EMPTY_CLIENT_EDIT_FORM,
      ambulatoryHomeAccess: 'klingel,schluessel,tresor',
    });

    expect(intake.homeAccess).toEqual(['klingel', 'schluessel', 'tresor']);
  });
});
