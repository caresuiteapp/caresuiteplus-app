// Generated native presentation from src/lib/office/messageWorkspace.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { OfficeMessageThread, OfficeMessage } from '@/types/office/messaging';
import { isClosedAppStatus } from './messagestatuslabels';
export type ConversationFilter = 'all' | 'unread' | 'active' | 'mine' | 'closed';
export const CONVERSATION_FILTERS: {
    key: ConversationFilter;
    label: string;
}[] = [
    { key: 'all', label: 'Alle' }, { key: 'unread', label: 'Ungelesen' },
    { key: 'active', label: 'Offen' }, { key: 'mine', label: 'Meine' }, { key: 'closed', label: 'Abgeschlossen' },
];
export const MESSAGE_PRIORITIES = [
    { key: 'low', label: 'Niedrig' }, { key: 'normal', label: 'Normal' },
    { key: 'high', label: 'Wichtig' }, { key: 'urgent', label: 'Dringend' },
] as const;
export function conversationName(thread: OfficeMessageThread) {
    if (thread.threadType === 'employee_group_office')
        return thread.subject || 'Teamgruppe';
    return thread.clientName || thread.employeeName || thread.participantName || thread.subject || 'Unterhaltung';
}
export function messageInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || 'CS').toLocaleUpperCase('de-DE');
}
export function messageTime(value: string | null | undefined, full = false) {
    if (!value || !Number.isFinite(Date.parse(value)))
        return 'Noch keine Nachricht';
    const date = new Date(value);
    if (full)
        return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return date.toDateString() === new Date().toDateString()
        ? date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
export function messageDay(value: string) {
    if (!Number.isFinite(Date.parse(value)))
        return 'Datum unbekannt';
    const date = new Date(value);
    if (date.toDateString() === new Date().toDateString())
        return 'Heute';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function selectConversations(threads: OfficeMessageThread[], query: string, filter: ConversationFilter, profileId?: string | null) {
    const terms = query.trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean);
    return threads.filter(thread => {
        if (thread.status === 'deleted')
            return false;
        if (filter === 'unread' && thread.unreadCount <= 0)
            return false;
        if (filter === 'active' && isClosedAppStatus(thread.status))
            return false;
        if (filter === 'closed' && !isClosedAppStatus(thread.status))
            return false;
        if (filter === 'mine' && (!profileId || thread.assignedToUserId !== profileId))
            return false;
        const haystack = [thread.subject, conversationName(thread), thread.participantName, thread.categoryLabel, thread.lastMessagePreview, ...(thread.employeeParticipantNames ?? [])].filter(Boolean).join(' ').toLocaleLowerCase('de-DE');
        return terms.every(term => haystack.includes(term));
    }).sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt));
}
export function conversationExport(thread: OfficeMessageThread, messages: OfficeMessage[]) {
    return [`CareSuite HealthOS · Gesprächsverlauf`, thread.subject, conversationName(thread),
        `Exportiert: ${new Date().toLocaleString('de-DE')}`, '',
        ...messages.flatMap(message => [`${messageTime(message.sentAt, true)} · ${message.senderDisplayName}${message.isInternalNote ? ' · Interne Notiz' : ''}`, message.body, '']),
        'Anhänge sind separat in der Unterhaltung verfügbar.',
    ].join('\n');
}
export function parseConversationFilter(filter: unknown, age: unknown): ConversationFilter {
    if (CONVERSATION_FILTERS.some(item => item.key === filter))
        return filter as ConversationFilter;
    if (age === 'old' || age === 'closed')
        return 'closed';
    if (age === 'new')
        return 'unread';
    if (age === 'current')
        return 'active';
    return 'all';
}
export function bytesLabel(bytes: number | null) {
    return bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}
