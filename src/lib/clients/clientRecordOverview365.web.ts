import { buildClientRecordOverview as buildSharedOverview } from './clientRecordOverview.ts';
import type { ClientRecordOverview as SharedOverview } from './clientRecordOverview.ts';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientCareContext, ClientRecordTabKey } from './clientIntakeFieldRules';
import { captureClientDocumentEvidence } from './clientDocumentEvidence.web.ts';
import type { ClientDocumentEvidence } from './clientDocumentEvidence.web.ts';
export type { ClientRecordSignedDocument, ClientRecordQuickLink } from './clientRecordOverview.ts';
import {captureClientRecordDates,type ClientRecordDates} from './clientRecordDates.web.ts';
import { captureClientRecordAppointmentEvidence, type ClientRecordAppointmentEvidence } from './clientRecordAppointmentEvidence.web.ts';
export type ClientRecordOverview = SharedOverview & { documentEvidence: ClientDocumentEvidence; recordDates: ClientRecordDates; appointmentEvidence: ClientRecordAppointmentEvidence };

export function buildClientRecordOverview(detail: ClientFullDetail, careContexts: ClientCareContext[], availableTabs: ClientRecordTabKey[]): ClientRecordOverview {
  const documentEvidence = captureClientDocumentEvidence(detail, { tenantId: detail && Object.getOwnPropertyDescriptor(detail, 'tenantId')?.value, clientId: detail && Object.getOwnPropertyDescriptor(detail, 'id')?.value });
  const appointmentEvidence = captureClientRecordAppointmentEvidence(detail, { tenantId: documentEvidence.tenantId, clientId: documentEvidence.clientId });
  // Delegate the rest with the actual original DTO: do not sanitize consent/task collections or change other overview semantics.
  let overview: SharedOverview;
  try { if (documentEvidence.error || appointmentEvidence.error) throw Error(documentEvidence.error ?? appointmentEvidence.error!); overview = buildSharedOverview(detail, careContexts, availableTabs); }
  catch { overview = { fullName: 'Klientenübersicht nicht bestätigt', dateOfBirth: 'Ungeklärt', address: 'Ungeklärt', phone: 'Ungeklärt', primaryCostBearer: 'Ungeklärt', careLevel: 'Ungeklärt', serviceTypes: 'Ungeklärt', lastActivity: 'Ungeklärt', admissionDate: 'Ungeklärt', nextAppointment: 'Ungeklärt', openItemsSummary: 'Ungeklärt', signedDocuments: [], quickLinks: [] }; }
  const signedDocuments = documentEvidence.error ? [] : documentEvidence.contracts.filter(record => record.hasRecordedSigningTime).map(record => ({ id: record.id, title: record.title, signedAt: record.primary.raw as string, kind: 'contract' as const }));
  const recordDates = captureClientRecordDates(detail, { tenantId: documentEvidence.tenantId, clientId: documentEvidence.clientId });
  // Web-only admission and appointment fields separate DATE and dated plans from metadata and status hints.
  return { ...overview, admissionDate: documentEvidence.error ? 'Ungeklärt' : recordDates.admission.display, nextAppointment: documentEvidence.error ? 'Ungeklärt' : appointmentEvidence.appointmentDisplay, signedDocuments, documentEvidence, recordDates, appointmentEvidence };
}
