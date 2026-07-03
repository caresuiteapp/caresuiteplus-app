import { ROLE_LABELS } from '@/data/constants/roleLabels';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
  resolveEmploymentTypeLabel,
} from '@/lib/office/employeeCatalogLabels';
import {
  describeEmployeeTimeTrackingMode,
  resolveEmployeeTimeTrackingMode,
} from '@/lib/office/employeeHomeOfficeService';
import {
  buildEmployeePersonnelOverview,
} from '@/lib/office/employeePersonnelFileService';
import {
  labelBackgroundCheckStatus,
  labelEmploymentStatus,
  labelEmployeeDeployability,
  labelQualificationStatus,
  labelQualificationType,
} from '@/lib/office/employeePersonnelLabels';
import {
  COMPENSATION_TYPE_OPTIONS,
  EMPLOYEE_SALUTATION_OPTIONS,
  INSURANCE_TYPE_OPTIONS,
  PAYOUT_INTERVAL_OPTIONS,
  PAYOUT_METHOD_OPTIONS,
  resolvePayrollCatalogLabel,
} from '@/lib/office/employeePayrollCatalogService';
import {
  maskPortalIban,
  maskPortalInsuranceNumber,
  maskPortalTaxId,
} from '@/lib/portal/employeePortalPersonnelMasking';
import type { PortalEmployeeProfile } from '@/types/portal/employee';
import type {
  PortalEmployeePersonnelView,
  PortalProfileField,
  PortalProfileHistoryItem,
} from '@/types/portal/employeePersonnel';
import type { EmployeePersonnelFile } from '@/types/modules/employeePersonnelFile';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';

const EMPLOYEE_PORTAL_MODULE_LABELS = [
  'Heute & Einsätze',
  'Arbeitszeit',
  'Dokumente',
  'Nachrichten',
  'Profil',
];

const WORK_MATERIAL_STATUS_LABELS: Record<string, string> = {
  issued: 'Ausgegeben',
  return_pending: 'Rückgabe ausstehend',
  damaged: 'Beschädigt',
  lost: 'Verloren',
  returned: 'Zurückgegeben',
};

const WORK_MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  uniform: 'Bekleidung',
  equipment: 'Gerät / Ausstattung',
  keys: 'Schlüssel / Karte',
  other: 'Sonstiges',
};

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  contract: 'Vertrag',
  agreement: 'Vereinbarung',
  privacy: 'Datenschutz',
  confidentiality: 'Vertraulichkeit',
  briefing: 'Unterweisung',
  background_check: 'Führungszeugnis',
  qualification: 'Qualifikation',
  certificate: 'Zertifikat',
  warning: 'Abmahnung',
  termination: 'Kündigung',
  handover_protocol: 'Übergabeprotokoll',
  return_protocol: 'Rückgabeprotokoll',
  other: 'Sonstiges',
};

const TECHNICAL_HISTORY_TOKENS = [
  'employee_id',
  'auth_user',
  'tenant_id',
  'permission',
  'field_changes',
  'actor_id',
];

function formatOptionalDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = formatDate(value);
  return parsed || null;
}

function field(label: string, value: string | null | undefined): PortalProfileField | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '—') return null;
  return { label, value: trimmed };
}

function formatAddress(master: EmployeePersonnelFile['masterData']): string | null {
  const parts = [
    [master.street, master.houseNumber].filter(Boolean).join(' ').trim(),
    [master.postalCode, master.city].filter(Boolean).join(' ').trim(),
    master.country?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function resolveSalutationLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return EMPLOYEE_SALUTATION_OPTIONS.find((o) => o.key === value)?.label ?? null;
}

function sanitizeHistorySummary(summary: string): string {
  let text = summary.trim();
  for (const token of TECHNICAL_HISTORY_TOKENS) {
    if (text.toLowerCase().includes(token)) {
      return 'Stammdaten wurden aktualisiert.';
    }
  }
  text = text.replace(/master_data_updated/gi, 'Stammdaten aktualisiert');
  text = text.replace(/employee_id|auth_user_id|tenant_id/gi, '');
  return text.trim() || 'Änderung am Profil';
}

function projectHistory(file: EmployeePersonnelFile): PortalProfileHistoryItem[] {
  return file.auditEvents
    .map((event) => ({
      id: event.id,
      summary: sanitizeHistorySummary(event.summary),
      occurredAt: formatOptionalDate(event.createdAt) ?? '—',
    }))
    .filter((entry) => entry.summary.length > 0);
}

export function projectEmployeePersonnelForPortal(
  file: EmployeePersonnelFile,
  profile: PortalEmployeeProfile | null,
): PortalEmployeePersonnelView {
  const overviewModel = buildEmployeePersonnelOverview(file);
  const payroll = file.payrollPersonnel;
  const master = file.masterData;
  const employment = file.employment;

  const overview: PortalProfileField[] = [
    field('Name', profile?.displayName ?? `${master.firstName} ${master.lastName}`.trim()),
    field('Funktion', resolveEmployeeRoleLabel(master.roleTitle)),
    field('Status', labelEmploymentStatus(employment.employmentStatus)),
    field('Beschäftigungsart', resolveEmploymentTypeLabel(master.employmentType)),
    field('Eintrittsdatum', formatOptionalDate(master.entryDate)),
    field(
      'Wochenstunden',
      employment.weeklyHours != null ? `${employment.weeklyHours} Stunden` : profile?.weeklyHoursTarget != null
        ? `${profile.weeklyHoursTarget} Stunden`
        : null,
    ),
    field(
      'Arbeitszeit (Ist Woche)',
      profile?.weeklyHoursLogged != null ? `${profile.weeklyHoursLogged} Stunden` : null,
    ),
    field('Einsatzfähigkeit', labelEmployeeDeployability(overviewModel.deployability)),
    field(
      'Zeiterfassung',
      describeEmployeeTimeTrackingMode(
        resolveEmployeeTimeTrackingMode(file.portalAccess.roleKey, null),
      ),
    ),
  ].filter(Boolean) as PortalProfileField[];

  const masterData: PortalProfileField[] = [
    field('Vorname', master.firstName),
    field('Nachname', master.lastName),
    field('Geburtsdatum', formatOptionalDate(master.dateOfBirth)),
    field('Personalnummer', master.employeeNumber),
    field('Anrede', resolveSalutationLabel(payroll.personalData.salutation)),
    field('Akademischer Titel', payroll.personalData.academicTitle),
    field('Adresse', formatAddress(master)),
    field('Adresszusatz', payroll.personalData.addressSupplement),
    field('Nationalität', payroll.personalData.nationality),
    field('Kostenstelle', master.costCenter),
  ].filter(Boolean) as PortalProfileField[];

  const contact: PortalProfileField[] = [
    field('E-Mail', master.email),
    field('Telefon', master.phone),
    field('Mobil', master.mobile),
    field('Notfallkontakt', master.emergencyContactName),
    field('Notfalltelefon', master.emergencyContactPhone),
  ].filter(Boolean) as PortalProfileField[];

  const employmentFields: PortalProfileField[] = [
    field('Eintrittsdatum', formatOptionalDate(master.entryDate)),
    field('Beschäftigungsart', resolveEmploymentTypeLabel(master.employmentType)),
    field('Funktion', resolveEmployeeRoleLabel(master.roleTitle)),
    field('Vertragsart', resolveEmploymentTypeLabel(employment.contractType)),
    field('Probezeit bis', formatOptionalDate(employment.probationEndsAt)),
    field('Befristung bis', formatOptionalDate(employment.fixedTermEndsAt)),
    field('Standort / Team', profile?.locationLabel ?? resolveEmployeeDepartmentLabel(master.city)),
    field(
      'Wochenstunden',
      employment.weeklyHours != null ? `${employment.weeklyHours} Stunden` : null,
    ),
    field('Anstellungsstatus', labelEmploymentStatus(employment.employmentStatus)),
    field('Einsatzbereich', employment.deploymentArea),
  ].filter(Boolean) as PortalProfileField[];

  const compensationAmount =
    payroll.payroll.compensationAmount != null
      ? `${payroll.payroll.compensationAmount.toLocaleString('de-DE')} EUR`
      : null;

  const compensation: PortalProfileField[] = [
    field(
      'Vergütungsart',
      COMPENSATION_TYPE_OPTIONS.find((o) => o.key === payroll.payroll.compensationType)?.label ?? null,
    ),
    field('Betrag', compensationAmount),
    field(
      'Auszahlungsintervall',
      PAYOUT_INTERVAL_OPTIONS.find((o) => o.key === payroll.payroll.payoutInterval)?.label ?? null,
    ),
    field(
      'Auszahlungsart',
      PAYOUT_METHOD_OPTIONS.find((o) => o.key === payroll.payroll.payoutMethod)?.label ?? null,
    ),
    field('IBAN', maskPortalIban(payroll.payroll.iban)),
    field('Kreditinstitut', payroll.payroll.bankName),
    field('Kontoinhaber', payroll.payroll.accountHolder),
    field('Abweichender Kontoinhaber', payroll.payroll.alternateAccountHolder),
  ].filter(Boolean) as PortalProfileField[];

  const taxSocial: PortalProfileField[] = [
    field(
      'Lohnsteuerermittlung',
      resolvePayrollCatalogLabel('employee_tax_calculation', payroll.tax.taxCalculationType),
    ),
    field('Steuer-ID', maskPortalTaxId(payroll.tax.taxId)),
    field(
      'Versicherungsart',
      INSURANCE_TYPE_OPTIONS.find((o) => o.key === payroll.socialInsurance.insuranceType)?.label ?? null,
    ),
    field(
      'Krankenkasse',
      resolvePayrollCatalogLabel(
        'employee_health_insurance',
        payroll.socialInsurance.healthInsuranceKey,
      ),
    ),
    field(
      'Versorgungswerk angemeldet',
      payroll.socialInsurance.pensionFundRegistered ? 'Ja' : 'Nein',
    ),
    field(
      'Versicherungsnummer',
      maskPortalInsuranceNumber(payroll.socialInsurance.socialSecurityNumber),
    ),
    field(
      'Verwandtschaft zum Arbeitgeber',
      payroll.socialInsurance.employerRelationship ? 'Ja' : 'Nein',
    ),
    field(
      'Minijob-Hinweis',
      master.employmentType?.toLowerCase().includes('minijob') ? 'Mehrfachbeschäftigung beachten' : null,
    ),
  ].filter(Boolean) as PortalProfileField[];

  const secondaryEmployment: PortalProfileField[] =
    payroll.secondaryEmployments.length > 0
      ? payroll.secondaryEmployments.flatMap((row, index) => {
          const prefix = payroll.secondaryEmployments.length > 1 ? `${index + 1}. ` : '';
          return [
            field(`${prefix}Weitere Beschäftigung`, 'Ja'),
            field(`${prefix}Arbeitgeber`, row.employerName),
            field(
              `${prefix}Monatsentgelt brutto`,
              row.grossMonthlyIncome != null
                ? `${row.grossMonthlyIncome.toLocaleString('de-DE')} EUR`
                : null,
            ),
          ].filter(Boolean) as PortalProfileField[];
        })
      : [field('Weitere Beschäftigung', 'Nein')].filter(Boolean) as PortalProfileField[];

  const portalRoleKey = file.portalAccess.roleKey ?? 'employee_portal';
  const roles: PortalProfileField[] = [
    field('Portalrolle', ROLE_LABELS[portalRoleKey] ?? 'Mitarbeiterportal'),
    field('Funktion', resolveEmployeeRoleLabel(master.roleTitle)),
    field('Freigegebene Bereiche', EMPLOYEE_PORTAL_MODULE_LABELS.join(' · ')),
    field(
      'Zeiterfassungsmodus',
      describeEmployeeTimeTrackingMode(
        resolveEmployeeTimeTrackingMode(file.portalAccess.roleKey, null),
      ),
    ),
    field('Portalstatus', file.portalAccess.portalActive ? 'Aktiv' : 'Inaktiv'),
  ].filter(Boolean) as PortalProfileField[];

  const qualifications = file.qualifications.map((item) => ({
    id: item.id,
    title: item.title,
    statusLabel: labelQualificationStatus(item.status),
    validUntil: formatOptionalDate(item.validUntil),
    typeLabel: labelQualificationType(item.qualificationType),
  }));

  const documents = file.documents
    .filter((doc) => doc.releasedToPortal)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      validUntil: formatOptionalDate(doc.validUntil),
      categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] ?? 'Dokument',
    }));

  const portal: PortalProfileField[] = [
    field('Portalstatus', file.portalAccess.portalActive ? 'Aktiv' : 'Inaktiv'),
    field('Letzte Anmeldung', formatOptionalDate(file.portalAccess.lastLoginAt)),
    field('E-Mail (Portal)', master.email),
    field(
      'Passwort eingerichtet',
      file.portalAccess.passwordConfigured ? 'Ja' : 'Nein',
    ),
    field(
      'Zwei-Faktor vorbereitet',
      file.portalAccess.twoFactorPrepared ? 'Ja' : 'Nein',
    ),
  ].filter(Boolean) as PortalProfileField[];

  const deployabilityHints = [
    ...file.deployability.warnings.map((issue) => issue.message),
    ...file.deployability.blockers.map((issue) => issue.message),
  ];

  const driverQualification = file.qualifications.find(
    (q) => q.qualificationType === 'driving_license',
  );

  const deployability: PortalProfileField[] = [
    field('Einsatzfähigkeit', labelEmployeeDeployability(file.deployability.result)),
    field('Einsatzbereich', employment.deploymentArea),
    field(
      'Verfügbarkeit',
      file.deployability.availabilityOk ? 'Keine Einschränkung hinterlegt' : 'Einschränkung vorhanden',
    ),
    field('Führerschein', driverQualification ? driverQualification.title : null),
    field(
      'Führungszeugnis',
      labelBackgroundCheckStatus(file.backgroundCheck.status),
    ),
    ...(deployabilityHints.length > 0
      ? deployabilityHints.slice(0, 4).map((hint, index) =>
          field(index === 0 ? 'Hinweise' : `Hinweis ${index + 1}`, hint),
        )
      : []),
  ].filter(Boolean) as PortalProfileField[];

  const workMaterials = file.workMaterials.map((item) => ({
    id: item.id,
    itemName: item.itemName,
    statusLabel: WORK_MATERIAL_STATUS_LABELS[item.status] ?? item.status,
    issuedAt: formatOptionalDate(item.issuedAt),
    returnDueAt: formatOptionalDate(item.returnDueAt),
    categoryLabel: WORK_MATERIAL_CATEGORY_LABELS[item.category] ?? 'Sonstiges',
  }));

  const history = projectHistory(file);

  return {
    overview,
    masterData,
    contact,
    employment: employmentFields,
    compensation,
    taxSocial,
    secondaryEmployment,
    roles,
    qualifications,
    documents,
    portal,
    deployability,
    workMaterials,
    history,
  };
}

export function mergeProfileStatus(profile: PortalEmployeeProfile): string {
  return WORKFLOW_STATUS_LABELS[profile.status] ?? profile.status;
}
