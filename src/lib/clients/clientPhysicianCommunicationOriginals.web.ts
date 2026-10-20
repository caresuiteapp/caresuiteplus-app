import {
  assertClientNativeScope,
  captureClientNativePage,
  cloneClientNativeOriginal,
  freezeClientNativeOriginal,
  sameClientNativeOriginal,
  type ClientNativeRow,
  type ClientNativeScope,
} from './clientRecordNativeOriginal.web.ts';
import { woundUuid } from '../pflege/woundCareDomain.ts';

export const CLIENT_PHYSICIAN_COMMUNICATION_POOLS = {
  threads: 'communication_threads',
  messages: 'communication_messages',
  participants: 'communication_participants',
  attachments: 'communication_attachments',
  assignments: 'communication_assignments',
  readReceipts: 'communication_read_receipts',
  auditEvents: 'communication_audit_events',
} as const;

export type ClientPhysicianCommunicationHistoryWeb = Readonly<{
  thread: ClientNativeRow;
  messages: readonly ClientNativeRow[];
  participants: readonly ClientNativeRow[];
  attachments: readonly ClientNativeRow[];
  assignments: readonly ClientNativeRow[];
  readReceipts: readonly ClientNativeRow[];
  auditEvents: readonly ClientNativeRow[];
}>;

export type ClientPhysicianCommunicationOriginalsWeb = Readonly<{
  authority: 'inspection_only';
  signatureInference: 'not_inferred';
  prescriptionRelation: 'not_provided';
  scope: Readonly<ClientNativeScope>;
  histories: readonly ClientPhysicianCommunicationHistoryWeb[];
}>;

function ownRow(row: unknown): row is ClientNativeRow {
  return !!row && typeof row === 'object' && !Array.isArray(row)
    && [Object.prototype, null].includes(Object.getPrototypeOf(row));
}

/** Child communication tables have no client_id; their only accepted route is the exact delivered native thread UUID. */
export function captureClientCommunicationThreadPageWeb(
  input: unknown,
  scope: ClientNativeScope,
  threadId: string,
  cursor: string | null,
  requireClientId = false,
): readonly ClientNativeRow[] {
  assertClientNativeScope(scope);
  if (!woundUuid(threadId) || cursor !== null && !woundUuid(cursor)) {
    throw Error('Der native Kommunikationsverlauf hat ungeklärte Thread- oder Seitenkennungen.');
  }
  const page = cloneClientNativeOriginal(input);
  if (!Array.isArray(page)) throw Error('Eine native Kommunikationsseite wurde nicht als vollständige Liste geliefert.');
  let previous = cursor?.toLowerCase() ?? null;
  for (const row of page) {
    if (!ownRow(row) || !Object.hasOwn(row, 'id') || !woundUuid(row.id)
      || !Object.hasOwn(row, 'tenant_id') || row.tenant_id !== scope.tenantId
      || !Object.hasOwn(row, 'thread_id') || row.thread_id !== threadId
      || requireClientId && (!Object.hasOwn(row, 'client_id') || row.client_id !== scope.clientId)) {
      throw Error('Eine native Kommunikationszeile hat ungeklärte Kennungen oder Zuordnung.');
    }
    const id = (row.id as string).toLowerCase();
    if (previous !== null && id <= previous) throw Error('Native Kommunikationsseiten enthalten doppelte oder nicht fortschreitende Kennungen.');
    previous = id;
  }
  return freezeClientNativeOriginal(page);
}

/** Whole delivered communication originals. Participant labels are evidence, never verified physician identity. */
export function captureClientPhysicianCommunicationOriginalsWeb(
  input: unknown,
  scope: ClientNativeScope,
): ClientPhysicianCommunicationOriginalsWeb {
  assertClientNativeScope(scope);
  const supplied = cloneClientNativeOriginal(input);
  if (!ownRow(supplied) || Reflect.ownKeys(supplied).some(key => typeof key !== 'string' || !['threads', 'histories'].includes(key))
    || !Array.isArray(supplied.threads) || !Object.hasOwn(supplied, 'threads') || !Object.hasOwn(supplied, 'histories') || !Array.isArray(supplied.histories)) {
    throw Error('Der vollständige native Kommunikationsbestand ist nicht eindeutig geliefert.');
  }
  const threads = captureClientNativePage(supplied.threads, scope, null);
  if (threads.length !== supplied.histories.length) throw Error('Nicht jeder native Kommunikationsthread hat einen vollständigen Verlaufsbeleg.');
  const seen = new Set<string>();
  const histories = supplied.histories.map((history, index) => {
    if (!ownRow(history) || Reflect.ownKeys(history).some(key => typeof key !== 'string'
      || !['thread', 'messages', 'participants', 'attachments', 'assignments', 'readReceipts', 'auditEvents'].includes(key))) {
      throw Error('Ein nativer Kommunikationsverlauf ist nicht vollständig gekennzeichnet.');
    }
    const thread = threads[index];
    if (!sameClientNativeOriginal(history.thread, supplied.threads[index])) {
      throw Error('Der Kommunikationsverlauf ist nicht eindeutig an seinen nativen Thread gebunden.');
    }
    const threadId = thread.id as string;
    if (seen.has(threadId)) throw Error('Ein nativer Kommunikationsthread wurde mehrfach geliefert.');
    seen.add(threadId);
    return freezeClientNativeOriginal({
      thread,
      messages: captureClientCommunicationThreadPageWeb(history.messages, scope, threadId, null),
      participants: captureClientCommunicationThreadPageWeb(history.participants, scope, threadId, null),
      attachments: captureClientCommunicationThreadPageWeb(history.attachments, scope, threadId, null),
      assignments: captureClientCommunicationThreadPageWeb(history.assignments, scope, threadId, null),
      readReceipts: captureClientCommunicationThreadPageWeb(history.readReceipts, scope, threadId, null),
      auditEvents: captureClientCommunicationThreadPageWeb(history.auditEvents, scope, threadId, null, true),
    });
  });
  return freezeClientNativeOriginal({
    authority: 'inspection_only' as const,
    signatureInference: 'not_inferred' as const,
    prescriptionRelation: 'not_provided' as const,
    scope: { tenantId: scope.tenantId, clientId: scope.clientId },
    histories,
  });
}
