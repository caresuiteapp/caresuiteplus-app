import type {
  CompanyDepartment, CompanyEmployeePlacement, CompanyLegalEntity, CompanyOrganizationKind,
  CompanyOrganizationRecord, CompanyOrganizationSnapshot, CompanyOrganizationStatus,
  CompanyOrganizationView as BaseOrganizationView, CompanyRelationship, CompanySite,
} from '@/types/tenant/companyOrganization';

export type CompanyOrganizationView = BaseOrganizationView | 'access';
export type OrganizationRecord = CompanyLegalEntity | CompanySite | CompanyDepartment | CompanyEmployeePlacement | CompanyRelationship;
export type OrganizationEditDialog =
  | { kind: 'entity'; record?: CompanyLegalEntity }
  | { kind: 'site'; record?: CompanySite }
  | { kind: 'department'; record?: CompanyDepartment }
  | { kind: 'placement'; record?: CompanyEmployeePlacement }
  | { kind: 'relationship'; record?: CompanyRelationship };
export const ORGANIZATION_VIEWS: readonly { id: Exclude<CompanyOrganizationView, 'access'>; label: string; icon: string; kind: CompanyOrganizationKind; add: string; description: string }[] = [
  { id: 'sites', label: 'Standorte', icon: 'pin', kind: 'site', add: 'Standort anlegen', description: 'Adressen, Leitung und Erreichbarkeit Ihrer Niederlassungen.' },
  { id: 'departments', label: 'Abteilungen', icon: 'grid', kind: 'department', add: 'Abteilung anlegen', description: 'Teams, Zuständigkeiten und Abteilungsleitungen verbinden.' },
  { id: 'entities', label: 'Gesellschaften', icon: 'building', kind: 'entity', add: 'Gesellschaft anlegen', description: 'Weitere Gesellschaften mit eigenen Stammdaten verwalten.' },
  { id: 'relationships', label: 'Beteiligungen & Franchise', icon: 'transfer', kind: 'relationship', add: 'Beziehung anlegen', description: 'Beteiligungen, Franchisegebiete und vertragliche Zuständigkeiten festhalten.' },
  { id: 'placements', label: 'Personalzuordnung', icon: 'people', kind: 'placement', add: 'Person zuordnen', description: 'Mitarbeitende mit Standort, Abteilung und Zeitraum verbinden.' },
];
export const ORGANIZATION_STATUS: Record<CompanyOrganizationStatus, string> = { active: 'Aktiv', inactive: 'Inaktiv', archived: 'Archiviert' };
export const SITE_KINDS: Record<CompanySite['kind'], string> = { headquarters: 'Hauptsitz', branch: 'Niederlassung', office: 'Büro', service: 'Leistungsstandort', warehouse: 'Lager', other: 'Weiterer Standort' };
export const RELATIONSHIP_KINDS: Record<CompanyRelationship['kind'], string> = { subsidiary: 'Tochtergesellschaft', holding: 'Übergeordnete Holding', franchise: 'Franchise', cooperation: 'Kooperation' };
export function organizationMatches(search: string, values: (string | null | undefined)[]) {
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('de');
  const terms = normalize(search.trim()).split(/\s+/).filter(Boolean);
  const haystack = normalize(values.filter(Boolean).join(' '));
  return terms.every(term => haystack.includes(term));
}
export function organizationDate(value?: string | null) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 'Ungültiges Datum' : new Intl.DateTimeFormat('de-DE').format(date);
}
export function organizationToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function placementPeriod(placement: CompanyEmployeePlacement, today = organizationToday()) {
  if (placement.status === 'archived') return 'Archiviert';
  if (placement.status === 'inactive') return 'Inaktiv';
  if (placement.startsOn > today) return 'Geplant';
  if (placement.endsOn && placement.endsOn < today) return 'Beendet';
  return 'Aktuell';
}
export function organizationEntityName(snapshot: CompanyOrganizationSnapshot, id?: string | null) {
  return id ? snapshot.entities.find(entry => entry.id === id)?.name ?? 'Zugeordnete Gesellschaft' : 'Hauptunternehmen';
}
export function organizationPersonName(snapshot: CompanyOrganizationSnapshot, id?: string | null, allowed = true) {
  if (!id) return 'Noch keine Leitung zugeordnet';
  if (!allowed || !snapshot.employeesVisible) return 'Personaldaten geschützt';
  const employee = snapshot.employees.find(entry => entry.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}`.trim() || 'Mitarbeitende Person' : 'Person nicht mehr verfügbar';
}
export function organizationDescendants(records: readonly { id: string; parentEntityId?: string | null; parentDepartmentId?: string | null }[], id?: string) {
  const found = new Set(id ? [id] : []);
  if (!id) return found;
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      const parentId = record.parentEntityId ?? record.parentDepartmentId;
      if (parentId && found.has(parentId) && !found.has(record.id)) { found.add(record.id); changed = true; }
    }
  }
  return found;
}
export function organizationRecordById(snapshot: CompanyOrganizationSnapshot, kind: CompanyOrganizationKind, id: string): OrganizationRecord | undefined {
  const values = { entity: snapshot.entities, site: snapshot.sites, department: snapshot.departments, placement: snapshot.placements, relationship: snapshot.relationships };
  return values[kind].find(record => record.id === id);
}
export function organizationRecordTitle(snapshot: CompanyOrganizationSnapshot, kind: CompanyOrganizationKind, record: OrganizationRecord, employeesVisible = true) {
  if (kind === 'placement') return organizationPersonName(snapshot, (record as CompanyEmployeePlacement).employeeId, employeesVisible);
  if (kind === 'relationship') return (record as CompanyRelationship).partnerName;
  return (record as CompanyLegalEntity | CompanySite | CompanyDepartment).name;
}
export function organizationEditDialog(kind: CompanyOrganizationKind, record?: OrganizationRecord): OrganizationEditDialog {
  return { kind, record } as OrganizationEditDialog;
}

export function organizationDraft(dialog: OrganizationEditDialog) {
  const record = dialog.record;
  const string = (key: string, fallback = '') => {
    const value = record && (record as unknown as Record<string, unknown>)[key];
    return value === null || value === undefined ? fallback : String(value);
  };
  return {
    name: string('name'), code: string('code'), status: record?.status ?? 'active',
    entityId: string('entityId'), parentEntityId: string('parentEntityId'), siteId: string('siteId'),
    parentDepartmentId: string('parentDepartmentId'), departmentId: string('departmentId'),
    employeeId: string('employeeId'), leaderEmployeeId: string('leaderEmployeeId'), costCenterId: string('costCenterId'),
    contactName: string('contactName'), email: string('email'), phone: string('phone'), notes: string('notes'),
    street: string('street'), postalCode: string('postalCode'), city: string('city'), country: string('country', 'DE'),
    legalForm: string('legalForm'), registrationNumber: string('registrationNumber'), taxNumber: string('taxNumber'), vatId: string('vatId'), website: string('website'),
    siteKind: dialog.kind === 'site' ? string('kind', 'branch') as CompanySite['kind'] : 'branch' as CompanySite['kind'], openingHours: string('openingHours'),
    relationKind: dialog.kind === 'relationship' ? string('kind', 'franchise') as CompanyRelationship['kind'] : 'franchise' as CompanyRelationship['kind'],
    partnerEntityId: string('partnerEntityId'), partnerName: string('partnerName'), territory: string('territory'), ownershipPercent: string('ownershipPercent'), contractReference: string('contractReference'), responsibilities: string('responsibilities'),
    roleTitle: string('roleTitle'), startsOn: string('startsOn', dialog.kind === 'placement' ? organizationToday() : ''), endsOn: string('endsOn'),
    isPrimary: dialog.kind === 'placement' ? (record as CompanyEmployeePlacement | undefined)?.isPrimary ?? false : false,
    allocationPercent: string('allocationPercent'),
  };
}
export type OrganizationDraft = ReturnType<typeof organizationDraft>;
export function validateOrganizationDraft(kind: CompanyOrganizationKind, draft: OrganizationDraft) {
  const errors: Record<string, string> = {};
  if (['entity', 'site', 'department'].includes(kind) && !draft.name.trim()) errors.name = 'Bitte eine Bezeichnung eingeben.';
  if (['entity', 'site'].includes(kind) && !/^[A-Z]{2}$/.test(draft.country.trim().toUpperCase())) errors.country = 'Bitte ein zweistelliges Länderkürzel auswählen oder eingeben.';
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (kind === 'entity' && draft.website) {
    try { const url = new URL(draft.website.includes('://') ? draft.website : `https://${draft.website}`); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) errors.website = 'Bitte eine gültige Internetadresse eingeben.'; } catch { errors.website = 'Bitte eine gültige Internetadresse eingeben.'; }
  }
  if (kind === 'placement') {
    if (!draft.employeeId) errors.employeeId = 'Bitte eine Person auswählen.';
    if (!draft.startsOn) errors.startsOn = 'Bitte den Beginn der Zuordnung eintragen.';
    if (!draft.siteId && !draft.departmentId && !draft.entityId) errors.siteId = 'Bitte mindestens einen Standort, eine Abteilung oder eine Gesellschaft auswählen.';
  }
  if (kind === 'relationship') {
    if (!draft.partnerEntityId && !draft.partnerName.trim()) errors.partnerName = 'Bitte eine gespeicherte Gesellschaft oder den externen Vertragspartner angeben.';
    if (draft.partnerEntityId && draft.partnerEntityId === draft.entityId) errors.partnerEntityId = 'Eine Gesellschaft kann nicht ihr eigener Vertragspartner sein.';
  }
  for (const key of ['startsOn', 'endsOn'] as const) {
    if (draft[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(draft[key]) || Number.isNaN(Date.parse(`${draft[key]}T12:00:00Z`)) || new Date(`${draft[key]}T12:00:00Z`).toISOString().slice(0, 10) !== draft[key])) errors[key] = 'Bitte ein gültiges Datum eingeben.';
  }
  if (draft.endsOn && draft.startsOn && draft.endsOn < draft.startsOn) errors.endsOn = 'Das Ende darf nicht vor dem Beginn liegen.';
  for (const key of ['ownershipPercent', 'allocationPercent'] as const) {
    if (draft[key] && (!/^\d+(?:[.,]\d{1,2})?$/.test(draft[key]) || Number(draft[key].replace(',', '.')) > 100)) errors[key] = 'Bitte einen Wert zwischen 0 und 100 mit höchstens zwei Nachkommastellen eingeben.';
  }
  return errors;
}
export function organizationVersion(record?: CompanyOrganizationRecord) {
  return record ? { id: record.id, expectedVersion: record.version } : {};
}
export const nullableOrganizationValue = (value: string) => value.trim() || null;
