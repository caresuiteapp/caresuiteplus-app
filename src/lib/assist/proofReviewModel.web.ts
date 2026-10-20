import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

export type ReviewVisit = {
  id: string; client_id: string | null; legacy_assignment_id: string | null;
  planned_start_at: string | null; planned_end_at: string | null;
  actual_start_at: string | null; actual_end_at: string | null;
  execution_status: string; planning_status: string; canonical_status: string; title: string | null; service_name: string | null;
  clients: { first_name: string | null; last_name: string | null } | null;
  employees: { first_name: string | null; last_name: string | null } | null;
};
export type ReviewDocument = {
  id: string; client_id: string; portal_visible: boolean; status: string;
  created_at: string | null; signed_at: string | null; signature_required: boolean;
};
export type ReviewSignature = {
  id: string; visit_id: string; signed_at: string | null; signer_name: string;
  is_valid: boolean; metadata: Record<string, unknown> | null;
};
export type ReviewState = 'missing' | 'not_sent' | 'awaiting' | 'signed' | 'portal_signed' | 'revoked' | 'check';
export const REVIEW_STATES: Record<ReviewState, string> = {
  missing: 'Nachweis fehlt', not_sent: 'Noch nicht im Portal', awaiting: 'Unterschrift offen',
  signed: 'Unterzeichnet', portal_signed: 'Im Portal unterzeichnet', revoked: 'Freigabe zurückgezogen', check: 'Status prüfen',
};
export type ReviewEntry = {
  id: string; proof: AssistVisitProofRow | null; visitId: string; assignmentId: string;
  clientId: string; clientName: string; employeeName: string; service: string;
  startsAt: string | null; endsAt: string | null; state: ReviewState;
  releasedAt: string | null; availableAt: string | null; portalVisible: boolean;
  documentAt: string | null; documentVisible: boolean; signedAt: string | null;
  signed: boolean; signedViaPortal: boolean; signerName: string | null;
  waitSince: string | null; issue: string | null;
};
export type ReviewDataset = {
  proofs: AssistVisitProofRow[]; visits: ReviewVisit[];
  documents: ReviewDocument[]; signatures: ReviewSignature[]; loadedAt: string;
};
const str = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const person = (p: ReviewVisit['clients']) => p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() : '';
export const validTime = (v: unknown): string | null => {
  const s = str(v); return s && Number.isFinite(Date.parse(s)) ? s : null;
};
export function serviceDay(value: string | null): string {
  if (!validTime(value)) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value!));
}
export function dateTime(value: string | null): string {
  if (!validTime(value)) return 'Nicht dokumentiert';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value!));
}
export function elapsed(since: string | null, until = new Date().toISOString()): string {
  if (!validTime(since) || !validTime(until)) return 'Dauer unbekannt';
  const minutes = Math.max(0, Math.floor((Date.parse(until) - Date.parse(since!)) / 60_000));
  if (minutes < 60) return minutes < 1 ? 'Weniger als 1 Minute' : `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std. ${minutes % 60} Min.`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'Tag' : 'Tage'}${hours % 24 ? ` ${hours % 24} Std.` : ''}`;
}
export function completedVisit(visit: ReviewVisit): boolean {
  const excluded = ['abgesagt', 'storniert', 'cancelled', 'canceled'];
  if ([visit.canonical_status, visit.execution_status, visit.planning_status].some(s => excluded.includes(s))) return false;
  return Boolean(validTime(visit.actual_end_at)) || [visit.canonical_status, visit.execution_status].some(s => ['abgeschlossen', 'completed', 'done', 'signed'].includes(s));
}

/** Only persisted evidence determines status. A release is availability, never a read receipt. */
export function buildReviewEntries(data: ReviewDataset): ReviewEntry[] {
  const visits = new Map(data.visits.map(v => [v.id, v]));
  const documents = new Map(data.documents.map(d => [d.id, d]));
  const signatures = new Map(data.signatures.map(s => [s.id, s]));
  const covered = new Set(data.proofs.map(p => p.visitId));
  const entries: ReviewEntry[] = data.proofs.map(proof => {
    const visit = visits.get(proof.visitId);
    const snapshot = proof.payloadSnapshot ?? {};
    const nested = snapshot.signature && typeof snapshot.signature === 'object' ? snapshot.signature as Record<string, unknown> : {};
    const document = documents.get(proof.id);
    const signature = proof.signatureId ? signatures.get(proof.signatureId) : undefined;
    const invalidSignature = Boolean(signature && (!signature.is_valid || signature.visit_id !== proof.visitId));
    const signedAt = invalidSignature ? null : validTime(signature?.signed_at) ?? validTime(snapshot.clientPortalSignedAt) ?? validTime(snapshot.signedAt) ?? validTime(nested.signedAt) ?? validTime(document?.signed_at);
    const signed = !invalidSignature && Boolean(signature?.is_valid || signedAt);
    const signedViaPortal = signed && (snapshot.signedViaClientPortal === true || Boolean(validTime(snapshot.clientPortalSignedAt)) || signature?.metadata?.signedVia === 'client_portal');
    const releasedAt = validTime(proof.releasedToPortalAt);
    const portalVisible = proof.portalVisible && ['released', 'pending_client_signature'].includes(proof.portalReleaseStatus);
    const documentVisible = Boolean(document?.portal_visible && document.status === 'aktiv');
    const documentAt = validTime(document?.created_at);
    const clientId = visit?.client_id ?? str(snapshot.clientId) ?? document?.client_id ?? '';
    const availableAt = portalVisible ? releasedAt : null;
    let issue: string | null = null;
    if (invalidSignature) issue = 'Die zugeordnete Unterschrift ist ungültig. Eine erneute Prüfung ist erforderlich.';
    else if (proof.signatureId && !signature && !signedAt) issue = 'Eine Unterschrift ist verknüpft, ihre Bestätigung und ihr Zeitpunkt konnten jedoch nicht nachgewiesen werden.';
    else if (portalVisible && !documentVisible) issue = 'Der Nachweis ist im Bereich Nachweise freigegeben. Das zugehörige Portal-Dokument fehlt oder ist nicht sichtbar.';
    else if (!portalVisible && documentVisible) issue = 'Das Portal-Dokument ist noch sichtbar, obwohl die Nachweisfreigabe nicht aktiv ist.';
    else if (document && clientId && document.client_id !== clientId) issue = 'Die Klientenzuordnung des Portal-Dokuments stimmt nicht mit dem Einsatz überein.';
    else if (portalVisible && !releasedAt) issue = 'Die Portal-Freigabe ist aktiv; der Freigabezeitpunkt wurde nicht dokumentiert.';
    else if (signed && proof.portalReleaseStatus === 'pending_client_signature') issue = 'Eine Unterschrift liegt vor, die Portal-Anforderung ist aber noch offen.';
    const state: ReviewState = issue ? 'check' : proof.portalReleaseStatus === 'revoked' ? 'revoked' : signed ? 'signed' : portalVisible ? 'awaiting' : 'not_sent';
    return {
      id: proof.id, proof, visitId: proof.visitId,
      assignmentId: visit?.legacy_assignment_id ?? str(snapshot.assignmentId) ?? proof.visitId,
      clientId, clientName: person(visit?.clients ?? null) || str(snapshot.clientName) || 'Klient:in nicht zugeordnet',
      employeeName: person(visit?.employees ?? null) || str(snapshot.employeeName) || 'Nicht dokumentiert',
      service: visit?.service_name || str(snapshot.serviceName) || str(snapshot.title) || visit?.title || 'Leistungsnachweis',
      startsAt: validTime(visit?.actual_start_at) ?? validTime(visit?.planned_start_at) ?? validTime(snapshot.scheduledStart) ?? validTime(snapshot.plannedStartAt),
      endsAt: validTime(visit?.actual_end_at) ?? validTime(visit?.planned_end_at) ?? validTime(snapshot.scheduledEnd) ?? validTime(snapshot.plannedEndAt),
      state, releasedAt, availableAt, portalVisible, documentAt, documentVisible, signedAt, signed, signedViaPortal,
      signerName: str(signature?.signer_name) ?? str(snapshot.signerName) ?? str(nested.signerName),
      waitSince: portalVisible && !signed ? releasedAt : null, issue,
    };
  });
  for (const visit of data.visits) {
    if (covered.has(visit.id) || !completedVisit(visit)) continue;
    entries.push({
      id: `missing-${visit.id}`, proof: null, visitId: visit.id, assignmentId: visit.legacy_assignment_id || visit.id,
      clientId: visit.client_id ?? '', clientName: person(visit.clients) || 'Klient:in nicht zugeordnet',
      employeeName: person(visit.employees) || 'Nicht dokumentiert', service: visit.service_name || visit.title || 'Leistungsnachweis',
      startsAt: validTime(visit.actual_start_at) ?? validTime(visit.planned_start_at), endsAt: validTime(visit.actual_end_at) ?? validTime(visit.planned_end_at),
      state: 'missing', releasedAt: null, availableAt: null, portalVisible: false, documentAt: null, documentVisible: false,
      signedAt: null, signed: false, signedViaPortal: false, signerName: null, waitSince: null, issue: null,
    });
  }
  return entries;
}

export type ReviewFilters = { search: string; clientId: string; from: string; to: string; status: string; state: string; sort: string };
export const DEFAULT_REVIEW_FILTERS: ReviewFilters = { search: '', clientId: '', from: '', to: '', status: 'all', state: 'all', sort: 'newest' };
export function matchesReviewState(entry: ReviewEntry, state: string): boolean {
  if (state === 'all') return true;
  if (state === 'missing') return !entry.proof;
  if (state === 'not_sent') return Boolean(entry.proof && !entry.portalVisible && entry.proof.portalReleaseStatus !== 'revoked');
  if (state === 'signed') return entry.signed;
  if (state === 'portal_signed') return entry.signedViaPortal;
  if (state === 'awaiting') return entry.portalVisible && !entry.signed;
  if (state === 'revoked') return entry.proof?.portalReleaseStatus === 'revoked';
  if (state === 'check') return Boolean(entry.issue);
  return false;
}
export function filterReviewEntries(entries: ReviewEntry[], filters: ReviewFilters, includeState = true): ReviewEntry[] {
  const term = filters.search.trim().toLocaleLowerCase('de');
  const result = entries.filter(entry => {
    if (filters.clientId && entry.clientId !== filters.clientId) return false;
    if (includeState && !matchesReviewState(entry, filters.state)) return false;
    if (filters.status !== 'all' && entry.proof?.status !== filters.status) return false;
    const day = serviceDay(entry.startsAt);
    if ((filters.from || filters.to) && !day) return false;
    if (filters.from && day < filters.from || filters.to && day > filters.to) return false;
    return !term || [entry.clientName, entry.employeeName, entry.service, entry.proof?.proofNumber, entry.visitId, entry.proof?.id].join(' ').toLocaleLowerCase('de').includes(term);
  });
  const priority: Record<ReviewState, number> = { missing: 0, check: 1, awaiting: 2, not_sent: 3, revoked: 4, signed: 5, portal_signed: 5 };
  return result.sort((a, b) => {
    if (filters.sort === 'client') { const cmp = a.clientName.localeCompare(b.clientName, 'de'); if (cmp) return cmp; }
    if (filters.sort === 'attention') { const cmp = priority[a.state] - priority[b.state]; if (cmp) return cmp; }
    if (filters.sort === 'waiting') { const cmp = (a.waitSince ? Date.parse(a.waitSince) : Infinity) - (b.waitSince ? Date.parse(b.waitSince) : Infinity); if (cmp && Number.isFinite(cmp)) return cmp; if (a.waitSince && !b.waitSince) return -1; if (!a.waitSince && b.waitSince) return 1; }
    const aTime = a.startsAt ? Date.parse(a.startsAt) : 0, bTime = b.startsAt ? Date.parse(b.startsAt) : 0;
    return (filters.sort === 'oldest' ? aTime - bTime : bTime - aTime) || a.id.localeCompare(b.id);
  });
}
