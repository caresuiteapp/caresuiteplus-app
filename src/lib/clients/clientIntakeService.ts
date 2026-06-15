import type { ServiceResult } from '@/types';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  getRequiredFieldsForClientContext,
  getVisibleSectionsForClientContext,
  type IntakeSectionKey,
} from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { ClientFullDetail } from '@/types/modules/client';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { upsertDemoClientFullDetail } from '@/data/demo/clients';
import { upsertDemoClientIntakeRecord } from '@/data/demo/clients/intakeRecords';
import { helgaSchneiderFull } from '@/data/demo/clients/helga-schneider';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';

export function getIntakeStepsForContexts(contexts: ClientCareContext[]): IntakeSectionKey[] {
  return getVisibleSectionsForClientContext(contexts);
}

export function validateIntakeStep(
  section: IntakeSectionKey,
  form: ClientIntakeFormData,
): ClientIntakeErrors {
  const errors: ClientIntakeErrors = {};

  if (section === 'leistungsart') {
    if (form.careContexts.length === 0) {
      errors.careContexts = 'Mindestens eine Leistungsart auswählen.';
    }
  }

  if (section === 'stammdaten') {
    if (!form.firstName.trim()) errors.firstName = 'Vorname ist erforderlich.';
    if (!form.lastName.trim()) errors.lastName = 'Nachname ist erforderlich.';
    if (!form.dateOfBirth.trim()) errors.dateOfBirth = 'Geburtsdatum ist erforderlich.';
    if (!form.serviceStart.trim()) errors.serviceStart = 'Leistungsbeginn ist erforderlich.';
  }

  if (section === 'adresse_kontakt') {
    if (!form.street.trim()) errors.street = 'Straße ist erforderlich.';
    if (!form.zip.trim()) errors.zip = 'PLZ ist erforderlich.';
    if (!form.city.trim()) errors.city = 'Ort ist erforderlich.';
    if (!form.phone.trim() && !form.mobile.trim() && !form.email.trim()) {
      errors.phone = 'Telefon, Mobil oder E-Mail erforderlich.';
    }
  }

  const required = getRequiredFieldsForClientContext(form.careContexts);

  if (section === 'kostentraeger') {
    if (required.includes('billingType') && !form.billingType) {
      errors.billingType = 'Abrechnungsart ist erforderlich.';
    }
    if (required.includes('careLevel') && !form.careLevel) {
      errors.careLevel = 'Pflegegrad ist erforderlich.';
    }
    if (required.includes('careFund') && !form.careFundName.trim()) {
      errors.careFundName = 'Pflegekasse ist erforderlich.';
    }
    if (required.includes('insuranceNumber') && !form.insuranceNumber.trim()) {
      errors.insuranceNumber = 'Versichertennummer ist erforderlich.';
    }
  }

  if (section === 'notfall_zugang') {
    if (required.includes('emergencyContact')) {
      if (!form.emergencyContactName.trim()) errors.emergencyContactName = 'Notfallkontakt erforderlich.';
      if (!form.emergencyContactPhone.trim()) errors.emergencyContactPhone = 'Notfall-Telefon erforderlich.';
    }
    if (required.includes('homeAccess') && !form.homeAccess) {
      errors.homeAccess = 'Wohnungszugang ist erforderlich.';
    }
    if (required.includes('facility') && !form.facilityName.trim()) {
      errors.facilityName = 'Einrichtung ist erforderlich.';
    }
    if (required.includes('roomNumber') && !form.roomNumber.trim()) {
      errors.roomNumber = 'Zimmernummer ist erforderlich.';
    }
  }

  if (section === 'versorgung') {
    if (required.includes('consultingReason') && !form.consultingReason.trim()) {
      errors.consultingReason = 'Beratungsanlass ist erforderlich.';
    }
    if (required.includes('consultingType') && !form.consultingType) {
      errors.consultingType = 'Beratungsart ist erforderlich.';
    }
    if (required.includes('familyDoctor') && !form.familyDoctor.trim()) {
      errors.familyDoctor = 'Hausarzt ist erforderlich.';
    }
    if (required.includes('supportWishes') && form.supportWishes.length === 0) {
      errors.supportWishes = 'Gewünschte Unterstützung auswählen.';
    }
  }

  if (section === 'vertraege_einwilligungen') {
    if (!form.consentDatenschutz) errors.consentDatenschutz = 'Datenschutzeinwilligung erforderlich.';
    if (!form.consentVertrag) errors.consentVertrag = 'Vertrag/Leistungsvereinbarung erforderlich.';
  }

  return errors;
}

export function hasIntakeErrors(errors: ClientIntakeErrors): boolean {
  return Object.keys(errors).length > 0;
}

export async function submitClientIntake(
  tenantId: string,
  form: ClientIntakeFormData,
): Promise<ServiceResult<{ id: string }>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Intake: Migration anwenden und Repository erweitern.' };
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;

    const id = `client-intake-${Date.now()}`;
    const now = new Date().toISOString();

    upsertDemoClientIntakeRecord(id, form);
    upsertDemoClientFullDetail(buildMinimalFullDetail(id, form, now));

    return { ok: true, data: { id } };
  }, { delayMs: 500 });
}

function buildMinimalFullDetail(
  id: string,
  form: ClientIntakeFormData,
  now: string,
): ClientFullDetail {
  const base = { ...helgaSchneiderFull };
  return {
    ...base,
    id,
    tenantId: DEMO_TENANT_ID,
    firstName: form.firstName,
    lastName: form.lastName,
    dateOfBirth: form.dateOfBirth,
    careLevel: form.careLevel ? form.careLevel.replace('pg', 'PG ').toUpperCase() : null,
    status: 'aktiv',
    primaryContactPhone: form.phone || form.mobile,
    city: form.city,
    zip: form.zip,
    street: `${form.street} ${form.houseNumber}`.trim(),
    phone: form.phone,
    email: form.email,
    notes: form.specialNotes,
    createdAt: now,
    updatedAt: now,
    core: {
      ...base.core,
      id,
      tenantId: DEMO_TENANT_ID,
      firstName: form.firstName,
      lastName: form.lastName,
      salutation: form.salutation,
      gender: form.gender as import('@/types/modules/client').ClientCore['gender'],
      dateOfBirth: form.dateOfBirth,
      insuranceNumber: form.insuranceNumber,
      createdAt: now,
      updatedAt: now,
    },
    careContexts: form.careContexts,
  } as import('@/types/modules/client').ClientFullDetail & { careContexts?: ClientCareContext[] };
}

export function createEmptyIntakeForm(): ClientIntakeFormData {
  return { ...EMPTY_CLIENT_INTAKE_FORM };
}
