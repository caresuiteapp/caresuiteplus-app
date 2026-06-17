import type { Database } from '@/lib/supabase/database.types';
import type { OfficeAuditEntry } from '@/lib/officeCore/auditLogService';

export type ClientAuditRow = {
  id: string;
  action: string;
  details: string | null;
  actor_name: string;
  created_at: string;
  client_id: string;
};

export type CostCarrierAuditRow = Database['public']['Tables']['cost_carrier_audit_events']['Row'];

export type ClientDocumentEventRow = {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
  client_id: string;
  profiles?: { display_name: string | null } | null;
};

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}

function resolveActorName(value: string | null | undefined): string {
  const name = value?.trim();
  return name || 'System';
}

export function mapClientAuditRow(row: ClientAuditRow): OfficeAuditEntry {
  const clientHint = row.client_id ? row.client_id.slice(0, 8) : 'unbekannt';
  return {
    id: `client-audit:${row.id}`,
    action: row.action,
    detail: row.details?.trim() || `Klient · ${clientHint}`,
    actor: resolveActorName(row.actor_name),
    category: 'Klient',
    icon: '👥',
    timestamp: row.created_at,
  };
}

export function mapCostCarrierAuditRow(row: CostCarrierAuditRow): OfficeAuditEntry {
  const metadata = row.metadata as Record<string, unknown> | null;
  const actorFromMeta =
    typeof metadata?.actor_name === 'string' ? metadata.actor_name : null;
  const entityLabel = row.entity_id
    ? `${row.entity_type} · ${row.entity_id.slice(0, 8)}`
    : row.entity_type;

  return {
    id: `cost-carrier:${row.id}`,
    action: row.action,
    detail: entityLabel,
    actor: resolveActorName(actorFromMeta ?? undefined),
    category: 'Kostenträger',
    icon: '🏥',
    timestamp: row.created_at,
  };
}

export function mapClientDocumentEventRow(row: ClientDocumentEventRow): OfficeAuditEntry {
  return {
    id: `document:${row.id}`,
    action: formatEventType(row.event_type),
    detail: row.summary,
    actor: resolveActorName(row.profiles?.display_name ?? undefined),
    category: 'Dokument',
    icon: '📄',
    timestamp: row.created_at,
  };
}

export function mergeOfficeAuditEntries(entries: OfficeAuditEntry[]): OfficeAuditEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
