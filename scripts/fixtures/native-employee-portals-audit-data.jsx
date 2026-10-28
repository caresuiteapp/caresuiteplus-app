import { makePortalAuditThread, makePortalAuditMessages } from './native-portal-chat-audit-data';
export { listMessageAttachments, uploadMessageAttachment, uploadPortalMessageAttachment, getMessageAttachmentSignedUrl, resolveMessageAttachmentUrl, buildMessageAttachmentPath } from './native-portal-chat-audit-data';
// Synthetic presentation contracts only. Every transport write is denied;
// successful persistence/readback is proved by the separate service/SQL tests.
import { dashboard as baseDashboard, appointment as baseAppointment, calendarEvents } from './native-portals-data';
export { formatPayrollMinutes, formatPayrollBalanceMinutes, formatPayrollMoney } from '../../src/lib/payroll/payrollCalculator';
const params = () => new URLSearchParams(location.search);
const screen = () => params().get('screen') ?? '';
const state = () => params().get('state') ?? 'ready';
const loading = () => state() === 'loading' || state() === 'linking';
const failed = () => state() === 'error' || state() === 'offline' || state() === 'unlinked';
const empty = () => state() === 'empty';
const error = () => state() === 'unlinked' ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : failed() ? 'Die Verbindung ist unterbrochen. Bitte versuchen Sie es erneut.' : null;
const now = '2026-10-26T14:00:00.000Z';
export const employeeClientRecords = Array.from({ length: 14 }, (_, index) => ({ clientId: index === 0 ? 'visual-client' : `visual-client-${index + 1}`, displayName: index === 0 ? 'Helene Musterfrau' : `Friedrich-Wilhelm Musterperson ${index + 1}`, city: 'Hannover', street: 'Gartenstraße 24', zip: '30159', careGrade: 'pg2', careGradeLabel: 'PG 2', phone: '0511 000000', mobile: null, hints: 'Bitte den seitlichen Eingang nutzen.', documentCount: 1, activeAssignmentCount: 1, lastAssignmentAt: null, nextAssignmentAt: baseAppointment.startsAt }));
const record = action => { window.__employeeAuditActions = [...(window.__employeeAuditActions ?? []), action]; };
const refresh = async () => { record({ type: 'refresh', screen: screen() }); return !failed(); };
const denied = async (...args) => { record({ type: 'blocked-transport-write', screen: screen(), args }); return { ok: false, error: 'Prüfgrenze: Diese Vorschau schreibt keine Daten und versendet keine Nachrichten.' }; };
const deniedThrow = async (...args) => { await denied(...args); throw new Error('Prüfgrenze: Native Geräte- und Schreibaktionen werden separat geprüft.'); };
const list = items => loading() || failed() || empty() ? [] : items;
const result = value => ({ data: loading() || failed() ? null : value, loading: loading(), error: error(), refreshError: null, refresh, refreshWithResult: refresh, silentRefresh: refresh, refreshing: false, isLiveConnected: false, cacheMeta: { fromCache: state() === 'cached', cachedAt: now } });

export function usePortalActor() {
  const unresolved = state() === 'unlinked' || state() === 'linking';
  return { tenantId: 'visual-tenant', employeeId: unresolved ? null : 'visual-employee', clientId: null, actorId: 'visual-person', roleKey: 'employee_portal', displayName: 'Marlene Beispiel-Mustermann', isReady: true, isLinkedReady: !unresolved, isResolvingEmployeeLink: state() === 'linking', isResolvingClientLink: false, isResolvingDisplayName: false, employeeLinkReadOnly: state() === 'offline', familyAccess: null };
}
export function useAuth() {
  const actor = usePortalActor();
  return { authReady: true, isLoading: false, isAuthenticated: state() !== 'anonymous', authMode: 'supabase', session: null, user: { id: 'visual-user', displayName: actor.displayName }, profile: { id: 'visual-person', tenantId: actor.tenantId, roleKey: actor.roleKey, employeeId: actor.employeeId, displayName: actor.displayName }, portalSession: { accountId: actor.actorId, tenantId: actor.tenantId, employeeId: actor.employeeId, roleKey: actor.roleKey, loginType: 'employee_portal', mustChangePassword: false, tenantName: 'Pflege & Alltag Nord', displayName: actor.displayName }, signOut: denied, updatePortalSession: denied, retryProfileBootstrap: refresh };
}
export function getEmployeeAuditRouteParams() {
  const selected = screen();
  const id = selected.includes('client-detail') ? 'visual-client' : selected.includes('signature-request') ? 'visual-request' : selected.includes('personal-signature') ? 'visual-personal-document' : selected.includes('document-detail') ? 'visual-document' : selected.includes('consultation-detail') ? 'visual-case' : 'visual-visit';
  return { id, threadId: 'visual-thread', ...(selected === 'employee-audit-compose' ? { compose: '1' } : {}) };
}
export const useEmployeePortalDashboard = () => ({ dashboard: loading() || failed() ? null : empty() ? { ...baseDashboard, todayAssignments: [], upcomingAssignments: [], openDocumentationCount: 0, missingSignatureCount: 0, openSignatureDocumentCount: 0 } : baseDashboard, loading: loading(), error: error(), refreshing: false, refreshError: null, fromCache: state() === 'cached', cachedAt: now, refresh, refreshWithResult: refresh });
export const useEmployeePortalClientRecords = () => ({ records: list(employeeClientRecords), loading: loading(), error: error(), refreshError: null, refresh });
export const useEmployeePortalClientRecordDetail = () => ({ notFound: empty(), record: loading() || failed() || empty() ? null : { ...employeeClientRecords[0], clientId: 'visual-client', houseNumber: '24', floor: '2', apartmentNumber: '12', dateOfBirth: '1948-04-16', email: 'helene@example.invalid', contacts: [], addresses: [], portalDocuments: [], assignments: [], assignmentHistory: [], documentsError: null, contactsError: null, assignmentsError: null }, loading: loading(), error: error(), refreshError: null, refresh });
export const useEmployeePortalCalendarEvents = () => ({ events: list(calendarEvents), loading: loading(), error: error(), refreshError: null, refreshing: false, refresh, config: { moduleColor: '#176ad2' } });
const appointment = { ...baseAppointment, tasks: ['Unterstützung im Haushalt', 'Gemeinsame Besorgungen'], clientId: 'visual-client', clientName: 'Helene Musterfrau', assignmentId: 'visual-visit', employeeId: 'visual-employee', scheduledStart: baseAppointment.startsAt, scheduledEnd: baseAppointment.endsAt, documentationPending: false, signaturePending: false, isLocked: false };
const executionDetail = {
  assignmentId: 'visual-visit', tenantId: 'visual-tenant', title: appointment.title,
  clientId: 'visual-client', clientName: 'Helene Musterfrau', locationAddress: appointment.location,
  plannedStartAt: appointment.startsAt, plannedEndAt: appointment.endsAt,
  actualStartAt: null, actualEndAt: null, onTheWayAt: null, arrivedAt: null,
  status: 'geplant', canonicalStatus: 'planned', notesForEmployee: 'Bitte den seitlichen Eingang nutzen.',
  accessHints: null, emergencyContact: null,
  tasks: [{ id: 'visual-task', title: 'Unterstützung im Haushalt', description: '', required: true, status: 'open', completionNote: null, requiresNote: false }],
  statusHistory: [], pauseEvents: [], documentationStatus: 'none', signatureStatus: 'none',
  requiresSignature: true, requiresDocumentation: true, requiresRoute: true,
  canStartExecution: true, canOpenRoute: true, canCaptureGps: false,
  allowedTransitions: ['unterwegs', 'nicht_erschienen'], isLocked: false, enabledModules: [],
};
export const usePortalAppointments = () => ({ isLinkedReady: usePortalActor().isLinkedReady, items: list([appointment]), loading: loading(), error: error(), refreshError: null, refreshing: false, showSuccess: false, refresh, isEmpty: empty(), fromCache: state() === 'cached', cachedAt: now, missingEmployeeLink: state() === 'unlinked', isResolvingEmployeeLink: state() === 'linking', supabaseSessionReady: true });
export const usePortalAppointmentDetail = () => ({ data: loading() || failed() || empty() ? null : { ...appointment, serviceType: 'Alltagsbegleitung und Hauswirtschaft', caregiverName: 'Marlene Beispiel-Mustermann', caregiverPhone: '0511 000000', preparationNotes: 'Bitte den seitlichen Eingang nutzen.', canExecute: true }, loading: loading(), error: error(), refresh, notFound: empty(), fromCache: state() === 'cached', cachedAt: now, refreshError: null });
const document = { id: 'visual-document', employeeId: 'visual-employee', title: 'Vereinbarung und Hinweise für Mitarbeitende', fileName: 'Vereinbarung.pdf', displayFileName: 'Vereinbarung.pdf', mimeType: 'application/pdf', fileSizeBytes: 185324, category: 'contract', status: 'freigegeben', updatedAt: now, createdAt: now, uploadedAt: now, visibility: 'portal_employee', sensitivity: 'normal' };
export const usePortalDocuments = () => ({ items: list([document]), loading: loading(), error: error(), refreshing: false, showSuccess: false, refresh, isEmpty: empty() });
export const usePortalDocumentDetail = () => ({ data: loading() || failed() || empty() ? null : { ...document, description: 'Bitte lesen Sie alle Angaben vollständig.', downloadReady: true, viewReady: true }, loading: loading(), error: error(), refresh, download: denied, downloadLoading: false, downloadError: null, successMessage: null, notFound: empty() });
export const useEmployeePortalUploads = () => ({ uploads: list([{ id: 'visual-upload', fileName: 'Arbeitsbescheinigung.pdf', status: 'pending', createdAt: now, reviewNote: null }]), loading: loading(), error: error(), refresh });
const profileFields = ['overview', 'masterData', 'contact', 'employment', 'compensation', 'taxSocial', 'secondaryEmployment', 'roles', 'portal', 'deployability'];
const personnel = { ...Object.fromEntries(profileFields.map(tab => [tab, [{ label: 'Prüfangabe', value: tab === 'overview' ? 'Marlene Beispiel-Mustermann' : 'Synthetischer vollständiger Prüfwert' }]])), qualifications: [{ id: 'visual-qualification', title: 'Unterstützung im Alltag', statusLabel: 'Gültig', validUntil: '2027-10-26', typeLabel: 'Schulung' }], documents: [{ id: 'visual-document', title: document.title, fileName: document.fileName, validUntil: null, categoryLabel: 'Vereinbarung' }], workMaterials: [{ id: 'visual-material', itemName: 'Dienstgerät', statusLabel: 'Ausgegeben', issuedAt: now, returnDueAt: null, categoryLabel: 'Arbeitsmittel' }], history: [{ id: 'visual-history', summary: 'Synthetische Aktualisierung Ihrer Personalakte', occurredAt: now }] };
export const useEmployeePortalProfile = () => ({ profile: loading() || failed() || empty() ? null : { employeeId: 'visual-employee', displayName: 'Marlene Beispiel-Mustermann', employeeNumber: 'EMP-001', email: 'marlene@example.invalid', mobile: '0170 0000000', city: 'Hannover', employmentType: 'Teilzeit' }, timesheet: [], loading: loading(), error: error(), refresh, missingEmployeeLink: state() === 'unlinked', isLiveConnected: false });
export const useEmployeePortalPersonnelView = () => ({ personnelView: loading() || failed() || empty() ? null : personnel, loading: loading(), error: error(), refresh, isLiveConnected: false });
export const useEmployeeMobilitySettings = () => ({ settings: { tenantId: 'visual-tenant', employeeId: 'visual-employee', transportModes: ['car'], routeStartType: 'home', routeEndType: 'home', routeStartAddress: null, routeEndAddress: null }, addressContext: { employeeHome: { street: 'Beispielstraße 3', zip: '30159', city: 'Hannover' }, tenantOffice: { street: 'Bürostraße 4', zip: '30159', city: 'Hannover' } }, loading: loading(), error: error(), saving: false, saveError: null, save: denied, refresh });
export const useNotifications = () => ({ notifications: list([{ id: 'visual-announcement', tenantId: 'visual-tenant', title: 'Dienstinformationen für den kommenden Monat', bodyPreview: 'Bitte beachten Sie die Hinweise zu Erreichbarkeit und Übergaben.', relatedBroadcastId: 'visual-broadcast', notificationType: 'broadcast', requireAcknowledgement: true, isAcknowledged: false, isRead: false, priority: 'normal', createdAt: now }]), loading: loading(), error: error(), refresh, tenantId: 'visual-tenant', userId: 'visual-user', employeeId: 'visual-employee' });
export const readClientPortalAnnouncement = async () => ({ ok: true, data: { body: 'Vollständige synthetische Dienstinformation mit allen Hinweisen bis zum letzten Satz.' } });
export const acknowledgeBroadcastNotification = denied;
const thread = makePortalAuditThread('employee');
export const usePortalOfficeMessages = () => ({ threads: list([thread]), loading: loading(), error: error(), refreshError: null, refresh, refreshWithResult: refresh, refreshing: false });
export const usePortalOfficeThreadDetail = () => ({ detail: loading() || failed() || empty() ? null : { ...thread, messages: makePortalAuditMessages('employee') }, loading: loading(), error: error(), refreshing: false, sending: false, refresh, sendMessage: denied, startNewChat: denied, markAsRead: denied, actorClientId: null, actorEmployeeId: 'visual-employee' });
const signatureRequest = { id: 'visual-request', tenantId: 'visual-tenant', employeeId: 'visual-employee', title: 'Vereinbarung zum Arbeitsverhältnis', status: 'sent', pendingSignatureRoles: ['employee'], signatures: [{ id: 'visual-signer', signerRole: 'employee', signerName: 'Marlene Beispiel-Mustermann', status: 'pending' }], createdAt: now, updatedAt: now, sentAt: now, dueDate: '2026-11-15', previewHtml: '<h1>Vollständige synthetische Vereinbarung</h1><p>Bitte alle Angaben vor der Unterschrift prüfen.</p>', history: [], templateKey: 'synthetic-employee-agreement' };
export const usePortalSignatureDetail = () => ({ detail: loading() || failed() || empty() ? null : { ...signatureRequest, id: 'visual-personal-document', status: 'open', versionNumber: 1, captures: [], auditTrail: [], signatureFields: [{ id: 'visual-field', role: 'employee', label: 'Unterschrift Mitarbeitende', order: 0, required: true }], nextSignerRole: 'employee', allowDownload: false, documentType: 'arbeitsvertrag', recipientType: 'employee', clientId: null, clientName: null, signatureRequirement: 'employee', priority: 'normal', requiredBeforeAssignment: false, assignmentId: null, creatorName: 'Pflegebüro', completedAt: null, previewPdfUrl: null, storagePath: null, sourceDocumentId: null, documentSourceType: 'template', employeeSigned: false, clientSigned: false }, loading: loading(), error: error(), refresh, signing: false, sign: denied });
export const logbookBundle = { profile: { tenantId: 'visual-tenant', employeeId: 'visual-employee', defaultVehicleId: 'visual-vehicle', mileageRateCents: 30, gpsConsent: false, licenseFrontPath: null, licenseBackPath: null }, vehicles: [{ id: 'visual-vehicle', tenantId: 'visual-tenant', employeeId: 'visual-employee', ownership: 'private', plate: 'H-QA 100', active: true, make: 'Prüffahrzeug', model: 'PKW' }], trips: [], confirmations: [], receipts: [], segments: [] };
const payroll = { statement: { id: 'visual-statement', employeeId: 'visual-employee', tenantId: 'visual-tenant', version: 1, status: 'published', pdfPath: null, snapshot: { generatedAt: now, actualWorkMinutes: 480, travelMinutes: 60, vacationMinutes: 0, sickMinutes: 0, plannedMinutes: 600, timeAccountBalanceMinutes: 30, earnedGrossCents: 16000, projectedGrossCents: 20000, approvedExpensesCents: 1250, projectedTotalPayoutCents: 21250 } }, expenses: [], mileageRateCents: 30 };
function queryData(options) {
  const key = String(options?.queryKey ?? '');
  if (key.startsWith('workday:')) return { session: null, events: [], statusLabel: 'Nicht gestartet', blockCount: 0 };
  if (key.startsWith('workday-settings:')) return { moduleEnabled: true, requirePrivacyConsent: true };
  if (key.startsWith('work-rules:')) return { violations: [], trafficLight: 'green' };
  if (key.startsWith('stored-work-rules:')) return [];
  if (key.startsWith('time-account-today:')) return { actualMinutes: 240, targetMinutes: 240, trafficLight: 'green' };
  if (key.startsWith('time-account-month:')) return { actualMinutes: 4800, targetMinutes: 4800, overtimeMinutes: 0, undertimeMinutes: 0, trafficLight: 'green' };
  if (key.startsWith('employee-times:')) return { visitTimes: [], visitSummaries: list([{ visitId: 'visual-visit', title: 'Unterstützung im Alltag', clientName: 'Helene Musterfrau', dateLabel: 'Montag, 26. Oktober 2026', plannedRange: '14:00–16:00', timelineText: 'Anfahrt 13:45 · Beginn 14:00 · Ende 16:00' }]), drivingLogs: [] };
  if (screen() === 'employee-audit-assignment-execute' && key.startsWith('["visual-tenant","visual-employee",')) return empty() ? null : executionDetail;
  if (key.startsWith('logbook-eligibility:')) return { eligible: true };
  if (key.startsWith('logbook-links:')) return { assignments: [appointment], clients: employeeClientRecords };
  if (key.startsWith('logbook:')) return empty() ? { ...logbookBundle, vehicles: [] } : logbookBundle;
  if (key.startsWith('payroll-month:')) return empty() ? { ...payroll, statement: null } : payroll;
  if (key.startsWith('absence:')) return list([{ id: 'visual-absence', absenceType: screen() === 'employee-audit-leave' ? 'vacation' : 'sick_leave', status: 'requested', startsAt: '2026-11-02', endsAt: '2026-11-03', internalNote: '', employeeNote: 'Synthetischer Antrag.' }]);
  if (screen() === 'employee-audit-signatures') return list([signatureRequest]);
  if (screen() === 'employee-audit-signature-request') return empty() ? null : signatureRequest;
  return undefined;
}
export function useAsyncQuery(_fetch, _deps, options) {
  if (options?.enabled === false) return { ...result(undefined), loading: false, error: null };
  const data = queryData(options);
  if (data === undefined) return { ...result(null), error: 'Prüfgrenze: Der genaue Datenvertrag dieser Ansicht ist noch nicht vollständig eingerichtet.' };
  return result(data);
}
export const fetchPortalCsDocumentRequests = async () => ({ ok: true, data: list([signatureRequest]) });
export const loadEmployeeLogbook = async () => logbookBundle;
export const resolveEmployeeLogbookEligibility = async () => ({ eligible: true });
export const berlinToday = () => '2026-10-26';
export const berlinDateKey = value => String(value).slice(0, 10);
export const requestLogbookLocationPermission = deniedThrow, getCurrentLogbookPoint = deniedThrow, createLogbookTrip = deniedThrow, appendLogbookPoints = deniedThrow, finishEmployeeLogbookRecording = deniedThrow, confirmEmployeeLogbookTrip = deniedThrow, confirmLogbookDay = deniedThrow, createLogbookReceipt = deniedThrow, saveLogbookProfile = deniedThrow, uploadLogbookFile = deniedThrow, addLogbookStop = deniedThrow;
export const startNativeBackgroundTracking = deniedThrow;
export const acquireEmployeeLogbookForegroundTracking = () => { throw new Error('Prüfgrenze: GPS wird nicht simuliert.'); };
export const resumeActiveEmployeeLogbookTracking = async () => null;
export const stopEmployeeLogbookTrackingForScope = async () => {};
export const flushLogbookPointQueue = async () => ({ remaining: 0 });
export const createExpenseClaim = denied, decidePayrollStatement = denied, getPayrollPdfUrl = denied, loadEmployeePayrollMonth = async () => ({ ok: true, data: payroll }), uploadExpenseReceipt = denied;
export const listWfmAbsencesForEmployee = async () => ({ ok: true, data: queryData({ queryKey: 'absence:' }) });
export const requestWfmAbsence = denied, withdrawWfmAbsenceRequest = denied;
export const fetchLivePortalAppointmentsForEmployee = async () => ({ ok: true, data: list([appointment]) });
export const fetchEmployeePortalClientRecords = async () => ({ ok: true, data: list(employeeClientRecords) });
export const listInternalNotes = async () => ({ ok: !failed(), error: error(), data: list([{ id: 'visual-note', tenantId: 'visual-tenant', senderUserId: 'visual-office-user', senderName: 'Pflegebüro', kind: 'callback', priority: 'high', title: 'Rückruf und gemeinsame Einsatzabstimmung', body: 'Bitte Rückruf übernehmen und den Bearbeitungsstand mitteilen.', dueDate: '2026-10-27', createdAt: now, recipients: [{ id: 'visual-delivery', employeeId: 'visual-employee', recipientUserId: 'visual-user', displayName: 'Marlene Beispiel-Mustermann', status: 'open', readAt: null, updatedAt: now, revision: 1, response: '' }] }]) });
export const updateInternalDelivery = denied;
export const fetchEmployeeLocationConsentRecord = async () => ({ ok: true, data: null });
export const upsertEmployeeLocationConsentRecord = denied;
export const getEmployeeLocationConsent = async () => ({ ok: true, data: { granted: false, grantedAt: null, explainedAt: null } });
const executionContext = { tenantId: 'visual-tenant', assignmentId: 'visual-visit', employeeId: 'visual-employee', profileId: 'visual-person', roleKey: 'employee_portal', assistVisitId: 'visual-visit', assignmentStatus: 'geplant', derivedStatus: 'geplant', consistencyStatus: 'consistent', inconsistencies: [], repairOptions: [], detail: executionDetail, liveContext: null, visitTimes: null, timeEvents: [], allowedActions: ['open_route', 'start_en_route', 'report_no_show'], diagnostics: { isServiceStarted: false, isServiceEnded: false, isTravelEnded: false, canEndService: false, inconsistentStatus: false, repairHint: null } };
export const resolveAssistExecutionContext = async () => ({ ok: true, data: executionContext });
export const loadEmployeePortalMobilitySelection = async () => null;
export const saveEmployeePortalMobilitySelection = deniedThrow;
export const mobilityActivatesEmployeeLogbook = mode => mode === 'car';
export const listEmployeePortalVisitAttachments = async () => ({ ok: true, data: [] });
export const uploadEmployeePortalVisitAttachment = denied;
export const employeeAuditFixtureCoverage = { supported: ['home', 'assignments', 'assignment-detail', 'assignment-execute', 'calendar', 'clients', 'client-detail', 'documents', 'document-detail', 'signatures', 'signature-request', 'personal-signature', 'profile', 'time-clock', 'times', 'leave', 'absence', 'logbook', 'payroll', 'uploads', 'messages', 'thread', 'announcements', 'mobility', 'tasks'], pendingExactContracts: ['academy', 'consultation', 'consultation-detail'], boundary: 'These data fixtures prove presentation only, never live writes/readback, permissions, native GPS/camera/biometry or hardware stability.' };

// PortalChrome calls the client-settings hook with enabled=false in this portal.
export const useClientPortalSettings = (enabled = true) => {
  if (enabled) throw Error('Employee audit must not request client portal settings');
  return {settings: null, loading: false, error: null, refresh: async () => {}};
};
