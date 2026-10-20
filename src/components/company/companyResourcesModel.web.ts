import type { CompanyContract, CompanyInsurancePolicy, CompanyVehicle, CompanyResourcesSnapshot, CompanyResourceDeadline, CompanyPaymentInterval } from '@/types/tenant/companyResources';

export type CompanyResourcesView = 'overview' | 'insurance' | 'contracts' | 'fleet' | 'assets';
export type ResourceRecord = CompanyContract | CompanyInsurancePolicy | CompanyVehicle;
export type ResourceRecordKind = 'contract' | 'insurance' | 'vehicle';
export const COMPANY_RESOURCES_VIEWS: { id: CompanyResourcesView; label: string; icon: string }[] = [
  { id: 'overview', label: 'Fristen & Überblick', icon: 'clock' }, { id: 'insurance', label: 'Versicherungen', icon: 'shield' },
  { id: 'contracts', label: 'Verträge', icon: 'receipt' }, { id: 'fleet', label: 'Fuhrpark', icon: 'car' }, { id: 'assets', label: 'Inventarzuordnung', icon: 'grid' },
];
export const RESOURCE_STATUS: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', ended: 'Beendet', archived: 'Archiviert', available: 'Einsatzbereit', maintenance: 'In Wartung', unavailable: 'Nicht verfügbar', planned: 'Geplant', returned: 'Zurückgegeben', cancelled: 'Storniert' };
export const PAYMENT_LABELS: Record<CompanyPaymentInterval, string> = { once: 'Einmalig', monthly: 'Monatlich', quarterly: 'Vierteljährlich', half_yearly: 'Halbjährlich', yearly: 'Jährlich' };
export function resourceDate(value?: string | null, time = false) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.valueOf()) ? 'Datum nicht verfügbar' : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(date);
}
export function resourceMoney(cents?: number | null) { return cents == null ? 'Nicht hinterlegt' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
export function resourceMatches(search: string, values: (string | null | undefined)[]) { return search.trim().toLocaleLowerCase('de').split(/\s+/).every(word => values.some(value => value?.toLocaleLowerCase('de').includes(word))); }
export function localDate(value = new Date()) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
export function localDateTime(value = new Date()) { return `${localDate(value)}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`; }
export function deadlineDays(value: string, now = new Date()) { return Math.round((Date.parse(`${value.slice(0, 10)}T12:00:00Z`) - Date.parse(`${localDate(now)}T12:00:00Z`)) / 86400000); }
export function deadlineLabel(value: string, now = new Date()) { const days = deadlineDays(value, now); return days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'Heute fällig' : days === 1 ? 'Morgen fällig' : `In ${days} Tagen`; }
export function companyResourceDeadlines(snapshot: CompanyResourcesSnapshot, now = new Date()): CompanyResourceDeadline[] {
  const list: CompanyResourceDeadline[] = [];
  const add = (resourceKind: CompanyResourceDeadline['resourceKind'], resourceId: string, title: string, label: string, value: string | null, uniqueId = resourceId) => {
    if (!value || !Number.isFinite(Date.parse(value))) return;
    const dueOn = value.length > 10 ? localDate(new Date(value)) : value;
    list.push({ id: `${resourceKind}:${uniqueId}:${label}`, resourceKind, resourceId, title, label, dueOn, overdue: deadlineDays(dueOn, now) < 0 });
  };
  snapshot.contracts.filter(row => row.status === 'active' || row.status === 'draft').forEach(row => {
    add('contract', row.id, row.title, 'Kündigungsstichtag', row.noticeOn); add('contract', row.id, row.title, 'Vertragsende', row.endsOn); add('contract', row.id, row.title, 'Vertrag prüfen', row.reviewOn);
  });
  snapshot.policies.filter(row => row.status === 'active' || row.status === 'draft').forEach(row => {
    add('insurance', row.id, row.title, 'Kündigungsstichtag', row.noticeOn); add('insurance', row.id, row.title, 'Versicherungsende', row.endsOn); add('insurance', row.id, row.title, 'Deckung prüfen', row.reviewOn);
  });
  snapshot.vehicles.filter(row => row.status !== 'archived').forEach(row => {
    add('vehicle', row.id, row.plate, 'HU fällig', row.huDueOn); add('vehicle', row.id, row.plate, 'Wartung fällig', row.serviceDueOn); add('vehicle', row.id, row.plate, 'Leasingende', row.leaseEndsOn);
  });
  snapshot.allocations.filter(row => row.status === 'active' || row.status === 'planned').forEach(row => {
    add('allocation', row.vehicleId, snapshot.vehicles.find(vehicle => vehicle.id === row.vehicleId)?.plate ?? 'Fahrzeug', 'Fahrzeugrückgabe', row.endsAt, row.id);
  });
  return list.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title, 'de'));
}
export function annualResourceCost(amount: number | null, interval: CompanyPaymentInterval) { return amount == null || interval === 'once' ? 0 : amount * ({ monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1 }[interval]); }
export function isAllocationOpen(status: string) { return status === 'active' || status === 'planned'; }
export function allocationsOverlap(start: string, end: string | null, otherStart: string, otherEnd: string | null) {
  const from = Date.parse(start), to = end ? Date.parse(end) : Infinity;
  const otherFrom = Date.parse(otherStart), otherTo = otherEnd ? Date.parse(otherEnd) : Infinity;
  return Number.isFinite(from) && Number.isFinite(otherFrom) && from < otherTo && otherFrom < to;
}
export type ResourceDraft = Record<string, string>;
export type ResourceField = { key: string; label: string; type?: 'date' | 'number' | 'textarea' | 'select' | 'money'; required?: boolean; wide?: boolean; choices?: Record<string, string>; suggestions?: string[]; hint?: string };
export type ResourceFieldGroup = { title: string; fields: ResourceField[] };
const placement: ResourceFieldGroup = { title: 'Organisation & Zuständigkeit', fields: [
  { key: 'entityId', label: 'Gesellschaft', type: 'select' }, { key: 'siteId', label: 'Standort', type: 'select' }, { key: 'departmentId', label: 'Abteilung', type: 'select' },
] };
const dates: ResourceField[] = [{ key: 'startsOn', label: 'Beginn', type: 'date' }, { key: 'endsOn', label: 'Ende', type: 'date' }, { key: 'noticeOn', label: 'Kündigungsstichtag', type: 'date', hint: 'Konkretes Datum für die Fristenübersicht.' }, { key: 'reviewOn', label: 'Nächste Prüfung', type: 'date' }];
const commonStatus: ResourceField = { key: 'status', label: 'Status', type: 'select', choices: { draft: 'Entwurf', active: 'Aktiv', ended: 'Beendet' } };
const commonDocument: ResourceFieldGroup = { title: 'Unterlagen & Notizen', fields: [{ key: 'documentId', label: 'Gespeichertes Unternehmensdokument', type: 'select', wide: true, hint: 'Verknüpft eine gespeicherte Fassung aus dem zentralen Dokumentenkatalog.' }, { key: 'notes', label: 'Notizen', type: 'textarea', wide: true }] };
export function resourceFields(kind: ResourceRecordKind): ResourceFieldGroup[] {
  if (kind === 'contract') return [
    { title: 'Vertrag', fields: [{ key: 'title', label: 'Bezeichnung', required: true, wide: true }, { key: 'contractType', label: 'Vertragsart', required: true, suggestions: ['Mietvertrag', 'Leasing', 'Dienstleistung', 'Software & Lizenz', 'Liefervertrag', 'Franchisevertrag', 'Wartung', 'Telekommunikation'] }, { key: 'counterparty', label: 'Vertragspartner', required: true }, { key: 'reference', label: 'Vertragsnummer' }, commonStatus] },
    { ...placement, fields: [...placement.fields, { key: 'responsibleEmployeeId', label: 'Verantwortliche Person', type: 'select' }] },
    { title: 'Laufzeit & Fristen', fields: [...dates, { key: 'noticeRule', label: 'Kündigungsregel', wide: true, suggestions: ['3 Monate zum Laufzeitende', '1 Monat zum Monatsende', '6 Wochen zum Quartalsende', 'Keine ordentliche Kündigung'] }, { key: 'renewalRule', label: 'Verlängerung', wide: true, suggestions: ['Keine automatische Verlängerung', 'Verlängerung um 12 Monate', 'Unbefristete Fortsetzung'] }] },
    { title: 'Kosten', fields: [{ key: 'costCents', label: 'Betrag in EUR', type: 'money' }, { key: 'paymentInterval', label: 'Zahlungsintervall', type: 'select', choices: PAYMENT_LABELS }] }, commonDocument,
  ];
  if (kind === 'insurance') return [
    { title: 'Versicherung', fields: [{ key: 'title', label: 'Bezeichnung', required: true, wide: true }, { key: 'insuranceType', label: 'Versicherungsart', required: true, suggestions: ['Betriebshaftpflicht', 'Berufshaftpflicht', 'Vermögensschadenhaftpflicht', 'Cyberversicherung', 'Rechtsschutz', 'Inhaltsversicherung', 'Gebäudeversicherung', 'Kfz-Versicherung', 'Betriebsunterbrechung', 'D&O'] }, { key: 'provider', label: 'Versicherer', required: true }, { key: 'policyNumber', label: 'Versicherungsnummer', required: true }, commonStatus] },
    { ...placement, fields: [...placement.fields, { key: 'responsibleEmployeeId', label: 'Verantwortliche Person', type: 'select' }] },
    { title: 'Laufzeit & Fristen', fields: dates },
    { title: 'Deckung & Beitrag', fields: [{ key: 'coverageCents', label: 'Deckungssumme in EUR', type: 'money' }, { key: 'excessCents', label: 'Selbstbeteiligung in EUR', type: 'money' }, { key: 'premiumCents', label: 'Beitrag in EUR', type: 'money' }, { key: 'paymentInterval', label: 'Zahlungsintervall', type: 'select', choices: PAYMENT_LABELS }, { key: 'coverageDescription', label: 'Versicherte Risiken & Geltungsbereich', type: 'textarea', wide: true }, { key: 'contractId', label: 'Zugehöriger Vertrag', type: 'select', wide: true }] }, commonDocument,
  ];
  return [
    { title: 'Fahrzeugakte', fields: [{ key: 'plate', label: 'Kennzeichen', required: true }, { key: 'vin', label: 'Fahrzeug-Identifizierungsnummer' }, { key: 'make', label: 'Hersteller', suggestions: ['Volkswagen', 'Mercedes-Benz', 'BMW', 'Škoda', 'Opel', 'Ford', 'Renault', 'Toyota', 'Hyundai', 'Kia'] }, { key: 'model', label: 'Modell' }, { key: 'vehicleType', label: 'Fahrzeugart', required: true, suggestions: ['Pkw', 'Kleinwagen', 'Kombi', 'Kleinbus', 'Transporter', 'Rollstuhlgerechtes Fahrzeug', 'Elektrofahrzeug'] }, { key: 'ownership', label: 'Nutzungsform', type: 'select', choices: { owned: 'Eigentum', leased: 'Leasing', rented: 'Miete' } }, { key: 'status', label: 'Betriebsstatus', type: 'select', choices: { available: 'Einsatzbereit', maintenance: 'In Wartung', unavailable: 'Nicht verfügbar' } }, { key: 'mileage', label: 'Kilometerstand', type: 'number', required: true }] }, placement,
    { title: 'Termine & Wartung', fields: [{ key: 'firstRegistrationOn', label: 'Erstzulassung', type: 'date' }, { key: 'purchasedOn', label: 'Anschaffung', type: 'date' }, { key: 'leaseEndsOn', label: 'Leasing- / Mietende', type: 'date' }, { key: 'huDueOn', label: 'Nächste Hauptuntersuchung', type: 'date' }, { key: 'serviceDueOn', label: 'Nächste Wartung', type: 'date' }, { key: 'serviceDueMileage', label: 'Wartung bei Kilometerstand', type: 'number' }] },
    { title: 'Verknüpfungen', fields: [{ key: 'insurancePolicyId', label: 'Kfz-Versicherung', type: 'select' }, { key: 'contractId', label: 'Kauf-, Miet- oder Leasingvertrag', type: 'select' }, { key: 'inventoryItemId', label: 'Inventareintrag', type: 'select', wide: true }] }, commonDocument,
  ];
}
export function resourceDraft(kind: ResourceRecordKind, record?: ResourceRecord): ResourceDraft {
  const draft: ResourceDraft = {};
  const source = record as unknown as Record<string, unknown> | undefined;
  resourceFields(kind).flatMap(group => group.fields).forEach(field => { const value = source?.[field.key]; draft[field.key] = value == null ? '' : field.type === 'money' ? String(Number(value) / 100) : String(value); });
  if (!record) { draft.status = kind === 'vehicle' ? 'available' : 'draft'; draft.paymentInterval = 'yearly'; if (kind === 'vehicle') { draft.ownership = 'owned'; draft.mileage = '0'; draft.vehicleType = 'Pkw'; } }
  return draft;
}
export function validateResourceDraft(kind: ResourceRecordKind, draft: ResourceDraft) {
  const errors: Record<string, string> = {};
  resourceFields(kind).flatMap(group => group.fields).forEach(field => {
    const value = draft[field.key]?.trim() ?? '';
    if (field.required && !value) errors[field.key] = 'Bitte ausfüllen.';
    if (value && (field.type === 'number' || field.type === 'money')) {
      const amount = Number(value.replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 0 || (field.type === 'number' && !Number.isInteger(amount)) || (field.type === 'money' && !/^\d+([.,]\d{1,2})?$/.test(value))) errors[field.key] = field.type === 'money' ? 'Bitte einen positiven Betrag mit höchstens zwei Nachkommastellen eingeben.' : 'Bitte eine positive ganze Zahl eingeben.';
    }
    if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) errors[field.key] = 'Bitte ein gültiges Datum eingeben.';
  });
  if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) errors.endsOn = 'Das Ende muss nach dem Beginn liegen.';
  if (draft.noticeOn && draft.endsOn && draft.noticeOn > draft.endsOn) errors.noticeOn = 'Der Kündigungsstichtag darf nicht nach dem Vertragsende liegen.';
  return errors;
}
