import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchClientPhysicianCommunicationOriginalReadWeb } from '@/lib/clients/clientPhysicianCommunicationOriginalRead.web';
import type { ClientPhysicianCommunicationOriginalsWeb } from '@/lib/clients/clientPhysicianCommunicationOriginals.web';
import { assertClientTimelineCapture, type ClientTimelineReadCapture } from '@/lib/clients/clientTimelineNoteAction.web';
import { freezeClientNativeOriginal, type ClientNativeRow } from '@/lib/clients/clientRecordNativeOriginal.web';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type Field = Readonly<{ state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved'; value: string | null }>;
type MessageProjection = Readonly<{ nativeId: string; fields: Readonly<Record<string, Field>> }>;
type ParticipantProjection = Readonly<{ nativeId: string; fields: Readonly<Record<string, Field>> }>;
type ThreadProjection = Readonly<{
  nativeId: string;
  fields: Readonly<Record<string, Field>>;
  messages: readonly MessageProjection[];
  participants: readonly ParticipantProjection[];
  attachmentIds: readonly string[];
  assignmentIds: readonly string[];
  readReceiptIds: readonly string[];
  auditEventIds: readonly string[];
  signatureInference: 'not_inferred';
  prescriptionRelation: 'not_provided';
}>;
type Envelope = Readonly<{ owner: object; key: string; ticket: number; entries: readonly ThreadProjection[] }>;
type Owner = { capture: ClientTimelineReadCapture | null; ticket: number; trusted: { envelope: Envelope; originals: ClientPhysicianCommunicationOriginalsWeb } | null };
type Props = { captureRead: () => ClientTimelineReadCapture | null };

const threadKeys = ['thread_type', 'status', 'priority', 'subject', 'title', 'module_key', 'document_id', 'last_message_id', 'last_message_at', 'created_at', 'updated_at'] as const;
const participantKeys = ['participant_type', 'participant_id', 'display_name', 'role', 'created_at', 'updated_at'] as const;
const messageKeys = ['sender_type', 'sender_user_id', 'sender_portal_session_id', 'sender_display_name', 'content_type', 'body_text', 'status', 'is_internal_note', 'is_visible_to_business', 'is_visible_to_employee', 'is_visible_to_client', 'is_visible_to_relative', 'sent_at', 'delivered_at', 'read_at', 'edited_at', 'deleted_at', 'delete_reason', 'reply_to_message_id', 'created_at', 'updated_at'] as const;

function captureCommunicationRead(factory: Props['captureRead']): ClientTimelineReadCapture | null {
  try {
    const value = factory();
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = ['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead'];
    const supplied = Reflect.ownKeys(value);
    if (supplied.length !== keys.length || supplied.some(key => typeof key !== 'string' || !keys.includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) return null;
    const captured = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(value, key)!.value])) as ClientTimelineReadCapture;
    if (!captured.owner || Object.getPrototypeOf(captured.owner) !== Object.prototype || !Object.isFrozen(captured.owner) || Reflect.ownKeys(captured.owner).length) return null;
    assertClientTimelineCapture(captured);
    return Object.freeze(captured);
  } catch { return null; }
}
function sameCapture(a: ClientTimelineReadCapture | null, b: ClientTimelineReadCapture | null): boolean {
  return !!a && !!b && a.owner === b.owner && a.key === b.key && a.tenantId === b.tenantId && a.clientId === b.clientId;
}
function field(row: ClientNativeRow, key: string): Field {
  if (!Object.hasOwn(row, key)) return { state: 'missing', value: null };
  const value = Object.getOwnPropertyDescriptor(row, key)!.value;
  if (value === undefined) return { state: 'undefined', value: null };
  if (value === null) return { state: 'null', value: null };
  if (value === '') return { state: 'empty', value: '' };
  return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'
    ? { state: 'value', value: String(value) }
    : { state: 'unresolved', value: null };
}
function project(collection: ClientPhysicianCommunicationOriginalsWeb): readonly ThreadProjection[] {
  return freezeClientNativeOriginal(collection.histories.map(history => ({
    nativeId: history.thread.id as string,
    fields: Object.fromEntries(threadKeys.map(key => [key, field(history.thread, key)])),
    messages: history.messages.map(row => ({ nativeId: row.id as string, fields: Object.fromEntries(messageKeys.map(key => [key, field(row, key)])) })),
    participants: history.participants.map(row => ({ nativeId: row.id as string, fields: Object.fromEntries(participantKeys.map(key => [key, field(row, key)])) })),
    attachmentIds: history.attachments.map(row => row.id as string),
    assignmentIds: history.assignments.map(row => row.id as string),
    readReceiptIds: history.readReceipts.map(row => row.id as string),
    auditEventIds: history.auditEvents.map(row => row.id as string),
    signatureInference: collection.signatureInference,
    prescriptionRelation: collection.prescriptionRelation,
  })));
}
function label(value: Field): string {
  return value.state === 'value' ? value.value! : value.state === 'missing' ? 'Nicht geliefert'
    : value.state === 'undefined' ? 'Ungeklärter eigener Feldwert' : value.state === 'null' ? 'NULL im Original'
    : value.state === 'empty' ? 'Leer im Original' : 'Originalformat ungeklärt';
}

/** Sensitive read-only history. Native labels do not verify physician identity or a signed prescription. */
export function ClientRecordPhysicianCommunicationPanel({ captureRead }: Props) {
  const colors = useAuroraAdaptiveText(), [visible, setVisible] = useState(20);
  const latest = useRef(captureRead), alive = useRef(true), owner = useRef<Owner>({ capture: null, ticket: 0, trusted: null });
  latest.current = captureRead;
  const read = captureCommunicationRead(captureRead);
  if ((owner.current.capture !== null || read !== null) && !sameCapture(owner.current.capture, read)) {
    owner.current.ticket++; owner.current.trusted = null; owner.current = { capture: read, ticket: 0, trusted: null };
  }
  const generation = owner.current, readKey = read?.key ?? 'no-current-physician-communication-read';
  useEffect(() => { alive.current = true; return () => { alive.current = false; owner.current.ticket++; owner.current.trusted = null; }; }, []);
  const currentRead = () => {
    if (!alive.current || owner.current !== generation || !read || !sameCapture(read, captureCommunicationRead(latest.current))) {
      throw Error('Der eigene aktuelle Kommunikations-Lesebezug wurde ersetzt.');
    }
    assertClientTimelineCapture(read);
  };
  const query = useAsyncQuery(async () => {
    try { currentRead(); } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Arztkommunikation nicht bestätigt.' }; }
    const ticket = ++generation.ticket; generation.trusted = null;
    const assertRead = () => { currentRead(); if (ticket !== generation.ticket) throw Error('Der eigene Kommunikationsabruf wurde ersetzt.'); };
    try {
      assertRead();
      const result = await fetchClientPhysicianCommunicationOriginalReadWeb(read!.tenantId, read!.clientId,
        { canRead: true, canViewSensitive: true, canViewCommunicationCenter: true, assertCurrentRead: assertRead });
      assertRead();
      if (!result.ok || result.data.state !== 'requested') return result;
      const entries = project(result.data.collection);
      assertRead();
      const envelope = Object.freeze({ owner: read!.owner, key: readKey, ticket, entries });
      generation.trusted = { envelope, originals: result.data.collection };
      return { ok: true as const, data: envelope };
    } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Arztkommunikation nicht bestätigt.' }; }
  }, [readKey, read?.owner, generation], { enabled: !!read, queryKey: `private-client-physician-communication:${readKey}` });
  const latestQuery = useRef(query); latestQuery.current = query;
  const projectionData = query.data, projectionTicket = generation.ticket;
  function mayRead(entry?: ThreadProjection): boolean {
    try { currentRead(); } catch { return false; }
    const current = latestQuery.current;
    return generation.ticket === projectionTicket && !!projectionData && current.data === projectionData
      && generation.trusted?.envelope === projectionData && projectionData.owner === read!.owner
      && projectionData.key === readKey && projectionData.ticket === generation.ticket
      && current.loading === false && current.refreshing === false && current.error === null && current.refreshError === null
      && current.previewData === false && current.tableMissing === false && current.cacheMeta?.fromCache === false
      && (current.cacheMeta.partialDetail === undefined || current.cacheMeta.partialDetail === false) && (!entry || projectionData.entries.includes(entry));
  }
  async function retry() {
    try { currentRead(); } catch { return; }
    if (generation.ticket !== projectionTicket || latestQuery.current.data !== projectionData || latestQuery.current.loading || latestQuery.current.refreshing) return;
    try { await query.refresh(); } catch { /* query owns its error state */ }
  }
  const ownPool = mayRead();
  return <SectionPanel title="Arztkommunikation · native Originalverläufe" subtitle="Telefonische Rückmeldungen, Rollenangaben, Nachrichten und Dokumentbezüge sind keine automatisch unterschriebene ärztliche Verordnung.">
    {!read ? <EmptyState title="Kommunikationsoriginale nicht freigegeben" message="Der aktuelle eigene sensible Aktenzugriff und das Recht auf das Kommunikationscenter sind nicht gemeinsam bestätigt." />
      : query.loading || query.refreshing ? <LoadingState message="Native Kommunikationsverläufe werden vollständig geladen…" />
      : !ownPool ? <ErrorState message={query.error ?? query.refreshError ?? 'Der aktuelle vollständig gelieferte Kommunikationsbestand ist nicht bestätigt.'} onRetry={() => { void retry(); }} />
      : !projectionData!.entries.length ? <EmptyState title="Keine klientengebundenen Threads im gelieferten Bestand" message="Dies bestätigt weder fehlende Arztkommunikation noch fehlende Verordnungen." />
      : <View style={styles.panel}>
        {projectionData!.entries.slice(0, visible).map(entry => mayRead(entry) ? <PremiumCard key={entry.nativeId} style={styles.card}>
          <Text selectable style={[styles.primary, { color: colors.primary }]}>Native Threadkennung: {entry.nativeId}</Text>
          <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Typ: {label(entry.fields.thread_type)} · Status: {label(entry.fields.status)} · Priorität: {label(entry.fields.priority)}</Text>
          <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Titel: {label(entry.fields.title)} · Betreff: {label(entry.fields.subject)}</Text>
          <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Native Dokumentreferenz: {label(entry.fields.document_id)}</Text>
          <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Threadzeiten: {label(entry.fields.created_at)} · {label(entry.fields.updated_at)} · letzte Nachricht {label(entry.fields.last_message_at)}</Text>
          <Text style={[styles.secondary, { color: colors.secondary }]}>Teilnehmende Originalangaben — Identität und ärztliche Rolle nicht verifiziert:</Text>
          {entry.participants.map(participant => <Text selectable key={participant.nativeId} style={[styles.secondary, { color: colors.secondary }]}>{participant.nativeId} · {label(participant.fields.participant_type)} · {label(participant.fields.display_name)} · {label(participant.fields.role)}</Text>)}
          <Text style={[styles.secondary, { color: colors.secondary }]}>Vollständig gelieferte Nachrichten in technischer UUID-Lesereihenfolge:</Text>
          {entry.messages.map(message => <View key={message.nativeId} style={styles.message}>
            <Text selectable style={[styles.primary, { color: colors.primary }]}>{message.nativeId} · {label(message.fields.sender_type)} · {label(message.fields.sender_display_name)}</Text>
            <Text selectable style={[styles.secondary, { color: colors.secondary }]}>{label(message.fields.body_text)}</Text>
            <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Status {label(message.fields.status)} · gesendet {label(message.fields.sent_at)} · zugestellt {label(message.fields.delivered_at)} · gelesen {label(message.fields.read_at)} · geändert {label(message.fields.edited_at)} · gelöscht {label(message.fields.deleted_at)}</Text>
          </View>)}
          <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Begleitpools: {entry.attachmentIds.length} Anlagen · {entry.assignmentIds.length} Zuweisungen · {entry.readReceiptIds.length} Lesebelege · {entry.auditEventIds.length} Auditereignisse</Text>
          <Text style={[styles.warning, { color: colors.secondary }]}>Kein nativer Verordnungsbezug geliefert. Auch eine telefonische Rückmeldung, eine Bezeichnung „Arzt“ oder ein verknüpftes Dokument bestätigt weder ärztliche Identität noch Unterschrift, Gültigkeit, Freigabe, Durchführung oder Abschluss.</Text>
        </PremiumCard> : null)}
        {projectionData!.entries.length > visible ? <PremiumButton title="Weitere Kommunikationsverläufe anzeigen" variant="ghost" onPress={() => { if (mayRead()) setVisible(value => value + 20); }} /> : null}
      </View>}
  </SectionPanel>;
}

const styles = StyleSheet.create({ panel: { gap: spacing.md, minWidth: 0 }, card: { gap: spacing.xs, minWidth: 0 }, message: { gap: spacing.xs, paddingLeft: spacing.sm, minWidth: 0 }, primary: { ...typography.body, flexShrink: 1 }, secondary: { ...typography.caption, flexShrink: 1 }, warning: { ...typography.caption, flexShrink: 1, fontWeight: '600' } });
