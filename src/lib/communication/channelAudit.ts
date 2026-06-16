import type {
  CommunicationChannel,
  CommunicationProviderAuditEntry,
  CommunicationProviderKey,
  CommunicationUseCase,
} from '@/types/communication/channels';

const preparedAuditLog: CommunicationProviderAuditEntry[] = [];

export type ChannelAuditInput = {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  channel?: CommunicationChannel | null;
  providerKey?: CommunicationProviderKey | null;
  useCase?: CommunicationUseCase | null;
  summary: string;
  blocked?: boolean;
  demo?: boolean;
};

export function recordCommunicationProviderAudit(input: ChannelAuditInput): CommunicationProviderAuditEntry {
  const entry: CommunicationProviderAuditEntry = {
    id: `comm-audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    channel: input.channel ?? null,
    providerKey: input.providerKey ?? null,
    useCase: input.useCase ?? null,
    summary: input.summary,
    blocked: Boolean(input.blocked),
    demo: Boolean(input.demo),
    createdAt: new Date().toISOString(),
  };
  preparedAuditLog.push(entry);
  return entry;
}

export function getCommunicationProviderAuditLog(): readonly CommunicationProviderAuditEntry[] {
  return preparedAuditLog;
}

export function clearCommunicationProviderAuditLog(): void {
  preparedAuditLog.length = 0;
}
