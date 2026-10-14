import { resolveClientInsuranceDisplay } from '@/lib/clients/clientInsurancePresentation.web';
import type { ClientCareContext, ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { CLIENT_RECORD_TAB_LABELS } from '@/lib/clients/clientIntakeFieldRules';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import { BILLING_TYPE_LABELS } from '@/types/modules/client/clientBilling';
import { CONTACT_RELATION_LABELS, TASK_FREQUENCY_LABELS } from '@/types/modules/client';
import type { ClientFullDetail } from '@/types/modules/client';
import type { AssignmentListItem } from '@/types/modules/assist';
import { isCancelledAssignmentStatus } from '@/types/modules/assignmentStatus';

export type ClientRecordSignedDocument = {
  id: string;
  title: string;
  signedAt: string;
  kind: 'consent' | 'contract' | 'document';
};

export type ClientRecordQuickLink = { tab: ClientRecordTabKey; label: string };
export type ClientRecordReviewItem = {
  id: string;
  title: string;
  description: string;
  tab: ClientRecordTabKey;
  count: number;
};

export type ClientRecordOverview = {
  fullName: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  primaryCostBearer: string;
  insuranceNumber: string;
  careLevel: string;
  serviceTypes: string;
  lastActivity: string;
  admissionDate: string;
  nextAppointment: string;
  openItemsSummary: string;
  openItemsCount: number;
  openItems: ClientRecordReviewItem[];
  signedDocuments: ClientRecordSignedDocument[];
  signedContractCount: number;
  documentCount: number;
  consentGrantedCount: number;
  consentTotalCount: number;
  quickLinks: ClientRecordQuickLink[];
  availableTabs: ClientRecordTabKey[];
  supportTasks: { id: string; title: string; frequency: string }[];
  emergencyContacts: { id: string; name: string; relationship: string; phone: string | null }[];
  recentActivity: { id: string; title: string; timestamp: string; actorName: string | null }[];
};

const EMPTY = '—';

function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY;
}

function buildAddress(detail: ClientFullDetail): string {
  const primary = detail.addresses.find((a) => a.isPrimary) ?? detail.addresses[0];
  if (primary) {
    const fromAddress = formatClientAddressLine(primary.street, primary.zip, primary.city);
    if (fromAddress) return fromAddress;
  }
  return formatClientAddressLine(detail.street, detail.zip, detail.city) || EMPTY;
}

export function resolveClientCostBearer(detail: ClientFullDetail): string {
  const fromProfile = detail.billingProfile?.costBearerName?.trim();
  if (fromProfile) return fromProfile;
  const fromCarrier = detail.costCarrier?.trim();
  if (fromCarrier) return fromCarrier;
  const billingType = detail.billingProfile?.billingType;
  return billingType ? BILLING_TYPE_LABELS[billingType] : EMPTY;
}

function buildActivity(detail: ClientFullDetail): ClientRecordOverview['recentActivity'] {
  // The legacy history commonly mirrors the timeline; do not display both twice.
  const source = detail.timeline?.length ? detail.timeline : detail.history ?? [];
  return source.filter((entry) => Number.isFinite(Date.parse(entry.timestamp)))
    .map((entry) => ({ id: entry.id, title: entry.title, timestamp: entry.timestamp, actorName: entry.actorName ?? null }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 4);
}

function resolveLastActivity(detail: ClientFullDetail): string {
  const times = [detail.updatedAt, ...(detail.timeline ?? []).map((entry) => entry.timestamp), ...(detail.history ?? []).map((entry) => entry.timestamp)]
    .filter((timestamp) => Number.isFinite(Date.parse(timestamp)));
  times.sort((a, b) => Date.parse(b) - Date.parse(a));
  return times[0] ? formatDateTime(times[0]) : EMPTY;
}

/** General workflow hints and total appointment counts do not identify a future appointment. */
export function selectNextClientAssignment(items: AssignmentListItem[], now = Date.now()): AssignmentListItem | null {
  const ended = new Set(['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen', 'nicht_erschienen']);
  return items.filter((item) => {
    if (isCancelledAssignmentStatus(item.assignmentStatus) || isCancelledAssignmentStatus(item.planningStatus) || isCancelledAssignmentStatus(item.executionStatus)) return false;
    if (ended.has(item.assignmentStatus ?? '') || ['abgeschlossen', 'archiviert', 'gesperrt'].includes(item.status) || item.actualEndAt) return false;
    const start = Date.parse(item.scheduledStart);
    const end = Date.parse(item.scheduledEnd);
    return Number.isFinite(start) && Number.isFinite(end) && end > start && end > now;
  }).sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))[0] ?? null;
}

function buildReviewItems(detail: ClientFullDetail, now: number): ClientRecordReviewItem[] {
  const items: ClientRecordReviewItem[] = [];
  if (detail.status === 'entwurf') {
    items.push({ id: 'intake', title: 'Aufnahme prüfen', description: 'Die Akte ist als Entwurf gespeichert.', tab: 'stammdaten', count: 1 });
  }
  if (!detail.phone?.trim() && !detail.primaryContactPhone?.trim()) {
    items.push({ id: 'phone', title: 'Telefonnummer ergänzen', description: 'Für direkte Rückfragen ist keine Telefonnummer hinterlegt.', tab: 'stammdaten', count: 1 });
  }
  const unsigned = (detail.contracts ?? []).filter((contract) => !contract.signedAt && !['archiviert', 'gesperrt'].includes(contract.status));
  if (unsigned.length) items.push({ id: 'contracts', title: `${unsigned.length} Vertrag${unsigned.length === 1 ? '' : 'e'} ohne erfasste Unterschrift`, description: 'Unterlagen prüfen und den tatsächlichen Stand abgleichen.', tab: 'dokumente', count: unsigned.length });
  const expired = (detail.consents ?? []).filter((consent) => consent.granted && consent.expiresAt && Date.parse(consent.expiresAt) <= now);
  if (expired.length) items.push({ id: 'expired-consents', title: `${expired.length} Einwilligung${expired.length === 1 ? '' : 'en'} abgelaufen`, description: 'Gültigkeit und betroffene Freigaben prüfen.', tab: 'dokumente', count: expired.length });
  // A declined optional consent is a decision, not an unfinished task.
  return items;
}

function buildSignedDocuments(detail: ClientFullDetail): ClientRecordSignedDocument[] {
  // Only an explicit signature timestamp is evidence. A file being active or
  // finalized, or a consent toggle with grantedAt, does not prove a signature.
  const seen = new Set<string>();
  return (detail.contracts ?? []).filter((contract) => {
    if (!contract.signedAt || !Number.isFinite(Date.parse(contract.signedAt))) return false;
    const identity = contract.documentId || contract.id;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map((contract) => ({
    id: contract.id,
    title: `Vertrag ${contract.contractNumber}`,
    signedAt: contract.signedAt!,
    kind: 'contract' as const,
  })).sort((a, b) => Date.parse(b.signedAt) - Date.parse(a.signedAt));
}

const QUICK_LINK_TABS: ClientRecordTabKey[] = ['stammdaten', 'einsaetze', 'dokumente', 'portal'];

export function buildClientRecordOverview(
  detail: ClientFullDetail,
  careContexts: ClientCareContext[],
  availableTabs: ClientRecordTabKey[],
  now = Date.now(),
  canViewSensitive = false,
): ClientRecordOverview {
  const openItems = buildReviewItems(detail, now);
  const signedDocuments = buildSignedDocuments(detail);
  const openItemsCount = openItems.reduce((sum, item) => sum + item.count, 0);
  return {
    fullName: `${detail.firstName} ${detail.lastName}`.trim(),
    dateOfBirth: detail.dateOfBirth ? formatDate(detail.dateOfBirth) : EMPTY,
    address: buildAddress(detail),
    phone: display(detail.phone?.trim() || detail.primaryContactPhone),
    primaryCostBearer: resolveClientCostBearer(detail),
    insuranceNumber: resolveClientInsuranceDisplay(detail, canViewSensitive),
    careLevel: formatCareLevel(detail.careLevel),
    serviceTypes: careContexts.length ? careContexts.map((context) => getCatalogLabel('leistungsart', context)).join(' · ') : EMPTY,
    lastActivity: resolveLastActivity(detail),
    admissionDate: detail.admissionDate ? formatDate(detail.admissionDate) : EMPTY,
    nextAppointment: 'Termine in der Einsatzübersicht prüfen',
    openItemsSummary: openItemsCount ? `${openItemsCount} Punkt${openItemsCount === 1 ? '' : 'e'} zu prüfen` : 'Keine Prüfpunkte aus den gespeicherten Angaben',
    openItemsCount,
    openItems,
    signedDocuments: signedDocuments.slice(0, 6),
    signedContractCount: signedDocuments.length,
    documentCount: detail.documents?.length ?? 0,
    consentGrantedCount: (detail.consents ?? []).filter((consent) => consent.granted && (!consent.expiresAt || Date.parse(consent.expiresAt) > now)).length,
    consentTotalCount: detail.consents?.length ?? 0,
    quickLinks: QUICK_LINK_TABS.filter((tab) => availableTabs.includes(tab)).map((tab) => ({ tab, label: CLIENT_RECORD_TAB_LABELS[tab] })),
    availableTabs: [...availableTabs],
    supportTasks: (detail.tasks ?? []).filter((task) => task.isActive).map((task) => ({ id: task.id, title: task.title, frequency: TASK_FREQUENCY_LABELS[task.frequency] ?? task.frequency })),
    emergencyContacts: (detail.contacts ?? []).filter((contact) => contact.isEmergency || contact.contactType === 'emergency_contact').map((contact) => ({ id: contact.id, name: `${contact.firstName} ${contact.lastName}`.trim(), relationship: contact.relationshipLabel || CONTACT_RELATION_LABELS[contact.relationship], phone: contact.phone })),
    recentActivity: buildActivity(detail),
  };
}
