// Fictional text-only conversations. No service, subscription or write runs.
const sentAt = '2026-10-26T14:00:00.000Z';
export function makePortalAuditThread(role) {
  const employee = role === 'employee';
  return {
    id: 'visual-thread', tenantId: 'visual-tenant',
    threadType: employee ? 'employee_office' : 'client_office',
    subject: 'Rückfrage zu meinem nächsten Einsatz', status: 'open', priority: 'normal',
    categoryId: null, categoryLabel: 'Allgemeine Anfrage',
    clientId: employee ? null : 'visual-client', clientName: employee ? null : 'Helene Musterfrau',
    employeeId: employee ? 'visual-employee' : null, employeeName: employee ? 'Marlene Beispiel-Mustermann' : null,
    participantName: employee ? 'Marlene Beispiel-Mustermann' : 'Helene Musterfrau',
    lastMessageAt: sentAt, lastMessagePreview: 'Ihr nächster Einsatz ist für morgen bestätigt.',
    unreadCount: 0, archivedAt: null, createdAt: sentAt, updatedAt: sentAt,
    isClosed: false, canReply: true,
  };
}
export function makePortalAuditMessages(role) {
  const employee = role === 'employee';
  const common = { tenantId: 'visual-tenant', threadId: 'visual-thread', createdAt: sentAt, updatedAt: sentAt,
    isInternalNote: false, isSystemMessage: false, status: 'read', readAt: sentAt };
  return [
    { ...common, id: 'visual-message-own', body: 'Können Sie mir bitte meinen nächsten Einsatz bestätigen?',
      senderType: employee ? 'employee_portal' : 'client_portal', senderProfileId: null,
      senderClientId: employee ? null : 'visual-client', senderEmployeeId: employee ? 'visual-employee' : null,
      senderDisplayName: employee ? 'Marlene Beispiel-Mustermann' : 'Helene Musterfrau', sentAt: '2026-10-26T13:50:00.000Z' },
    { ...common, id: 'visual-message-office', body: 'Ihr nächster Einsatz ist für morgen bestätigt.',
      senderType: 'office_profile', senderProfileId: 'visual-office', senderClientId: null,
      senderEmployeeId: null, senderDisplayName: 'Pflegebüro', sentAt },
  ];
}
const denied = async () => ({ ok: false, error: 'Prüfgrenze: Die Chatvorschau lädt keine Dateien und schreibt keine Daten.' });
export const listMessageAttachments = async () => ({ ok: true, data: [] });
export const uploadMessageAttachment = denied;
export const uploadPortalMessageAttachment = denied;
export const getMessageAttachmentSignedUrl = denied;
export const resolveMessageAttachmentUrl = denied;
export function buildMessageAttachmentPath() { throw new Error('Prüfgrenze: Kein Upload in der Chatvorschau.'); }
