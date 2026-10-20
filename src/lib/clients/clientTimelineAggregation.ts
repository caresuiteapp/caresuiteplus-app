import type { ClientTimelineEvent, TimelineEventType } from '@/types/modules/client';
import { TIMELINE_EVENT_TYPE_LABELS } from '@/types/modules/client/clientTimeline';

export type ClientTimelineAuditRow = {
  id: string;
  action: string;
  details: string | null;
  actor_name: string;
  created_at: string;
  client_id: string;
};

export type ClientTimelineDocumentEventRow = {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
  client_id: string;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  } | null;
};

const DOCUMENT_EVENT_TYPE_LABELS: Record<string, string> = {
  document_finalized: 'Dokument finalisiert',
  document_updated: 'Dokument aktualisiert',
  document_signed: 'Dokument signiert',
  document_uploaded: 'Dokument hochgeladen',
};

const AUDIT_ACTION_EVENT_TYPE: Record<string, TimelineEventType> = {
  'Klient:in angelegt': 'sonstige',
  'Stammdaten geändert': 'sonstige',
  'Status geändert': 'status',
  'Klient:in archiviert': 'status',
  'Portal-Zugang eingerichtet': 'portal',
  'Portal-Zugangscode erneuert': 'portal',
  'Aufgabe angelegt': 'einsatz',
  'Aufgabe geändert': 'einsatz',
  'Aufgabe gelöscht': 'einsatz',
  'Einwilligung geändert': 'einwilligung',
};

const AUDIT_ACTION_ICONS: Record<string, string> = {
  'Klient:in angelegt': '✨',
  'Stammdaten geändert': '✏️',
  'Status geändert': '🔄',
  'Klient:in archiviert': '📦',
  'Portal-Zugang eingerichtet': '🔐',
  'Portal-Zugangscode erneuert': '🔑',
  'Aufgabe angelegt': '✅',
  'Aufgabe geändert': '📝',
  'Aufgabe gelöscht': '🗑️',
  'Einwilligung geändert': '📋',
};

function resolveActorName(value: string | null | undefined): string {
  const name = value?.trim();
  return name || 'System';
}

function resolveProfileDisplayName(
  profile?: ClientTimelineDocumentEventRow['profiles'],
): string | undefined {
  if (!profile) return undefined;
  const full = profile.full_name?.trim();
  if (full) return full;
  const composed = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return composed || undefined;
}

function inferEventTypeFromAuditAction(action: string): TimelineEventType {
  return AUDIT_ACTION_EVENT_TYPE[action] ?? 'sonstige';
}

function inferIconFromAuditAction(action: string): string {
  return AUDIT_ACTION_ICONS[action] ?? '👥';
}

function formatDocumentEventType(eventType: string): string {
  return DOCUMENT_EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, ' ');
}

export function mapAuditRowToTimelineEvent(
  row: ClientTimelineAuditRow,
  clientId: string,
): ClientTimelineEvent {
  return {
    id: `audit:${row.id}`,
    clientId,
    eventType: inferEventTypeFromAuditAction(row.action),
    icon: inferIconFromAuditAction(row.action),
    title: row.action,
    subtitle: row.details?.trim() || null,
    timestamp: row.created_at,
    status: 'aktiv',
    actorName: resolveActorName(row.actor_name),
    isInternal: false,
    metadata: { source: 'audit' },
  };
}

export function mapDocumentEventToTimelineEvent(
  row: ClientTimelineDocumentEventRow,
  clientId: string,
): ClientTimelineEvent {
  return {
    id: `document:${row.id}`,
    clientId,
    eventType: 'dokument',
    icon: '📄',
    title: formatDocumentEventType(row.event_type),
    subtitle: row.summary,
    timestamp: row.created_at,
    status: 'abgeschlossen',
    actorName: resolveActorName(resolveProfileDisplayName(row.profiles)),
    isInternal: false,
    metadata: { source: 'document', eventType: row.event_type },
  };
}

export function sortTimelineEventsNewestFirst(events: ClientTimelineEvent[]): ClientTimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function aggregateClientTimelineEvents(input: {
  clientId: string;
  timelineEvents: ClientTimelineEvent[];
  auditEntries: ClientTimelineAuditRow[];
  documentEvents: ClientTimelineDocumentEventRow[];
  portalOnly?: boolean;
}): ClientTimelineEvent[] {
  const fromTimeline = input.portalOnly
    ? input.timelineEvents.filter((event) => !event.isInternal)
    : input.timelineEvents;

  const fromAudit = input.auditEntries.map((row) =>
    mapAuditRowToTimelineEvent(row, input.clientId),
  );

  const fromDocuments = input.documentEvents.map((row) =>
    mapDocumentEventToTimelineEvent(row, input.clientId),
  );

  const seen = new Set<string>();
  const merged: ClientTimelineEvent[] = [];

  for (const event of sortTimelineEventsNewestFirst([
    ...fromTimeline,
    ...fromAudit,
    ...fromDocuments,
  ])) {
    const dedupeKey = `${event.timestamp}|${event.title}|${event.subtitle ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(event);
  }

  return merged;
}

export function buildTimelineEntrySubtitle(event: ClientTimelineEvent): string {
  const parts = [
    TIMELINE_EVENT_TYPE_LABELS[event.eventType],
    event.actorName ? `durch ${event.actorName}` : null,
    event.subtitle?.trim() || null,
  ].filter(Boolean);
  return parts.join(' · ');
}
