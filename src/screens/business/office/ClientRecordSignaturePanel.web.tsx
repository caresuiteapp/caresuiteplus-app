import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchClientSignatureOriginalReadWeb } from '@/lib/clients/clientSignatureOriginalRead.web';
import type { ClientSignatureOriginalCollection } from '@/lib/clients/clientSignatureOriginals.web';
import { assertClientTimelineCapture, type ClientTimelineReadCapture } from '@/lib/clients/clientTimelineNoteAction.web';
import { freezeClientNativeOriginal, type ClientNativeRow } from '@/lib/clients/clientRecordNativeOriginal.web';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type SignatureField = { state: 'missing' | 'null' | 'empty' | 'present' | 'invalid'; value: string | null };
type SignatureMetadata = {
  nativeId: string; documentId: SignatureField; documentLink: 'delivered_document' | 'unresolved';
  signerName: SignatureField; signerRole: SignatureField; signedAt: SignatureField; createdAt: SignatureField;
  documentStatus: SignatureField;
};
type SignatureEnvelope = { owner: object; key: string; ticket: number; entries: SignatureMetadata[] };
type SignatureReadOwner = { capture: ClientTimelineReadCapture | null; ticket: number;
  trusted: { envelope: SignatureEnvelope; originals: ClientSignatureOriginalCollection } | null };
type Props = { captureRead: () => ClientTimelineReadCapture | null };

function captureSignatureRead(factory: Props['captureRead']): ClientTimelineReadCapture | null {
  try {
    const value = factory();
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = ['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead'];
    const supplied = Reflect.ownKeys(value);
    if (supplied.length !== keys.length || supplied.some(key => typeof key !== 'string' || !keys.includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) return null;
    const captured = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(value, key)!.value])) as ClientTimelineReadCapture;
    const owner = captured.owner;
    // A separate immutable empty capability token. No raw Parentreceipt, profile or original sidecar can be a prop.
    if (!owner || Object.getPrototypeOf(owner) !== Object.prototype || !Object.isFrozen(owner) || Reflect.ownKeys(owner).length) return null;
    assertClientTimelineCapture(captured);
    return Object.freeze(captured);
  } catch { return null; }
}
function sameSignatureCapture(a: ClientTimelineReadCapture | null, b: ClientTimelineReadCapture | null): boolean {
  return !!a && !!b && a.owner === b.owner && a.key === b.key && a.tenantId === b.tenantId && a.clientId === b.clientId;
}
function signatureField(row: ClientNativeRow | null, key: string): SignatureField {
  if (!row || !Object.hasOwn(row, key)) return { state: 'missing', value: null };
  const value = row[key];
  if (value === null) return { state: 'null', value: null };
  // Unknown structures never become serialized raw-signature/HTML extras in the display projection.
  if (typeof value !== 'string') return { state: 'invalid', value: null };
  return { state: value.trim() ? 'present' : 'empty', value };
}
function signatureMetadata(collection: ClientSignatureOriginalCollection): SignatureMetadata[] {
  return freezeClientNativeOriginal(collection.links.map(link => ({
    nativeId: link.signatureId, documentId: signatureField(link.original, 'document_id'), documentLink: link.state,
    signerName: signatureField(link.original, 'signer_name'), signerRole: signatureField(link.original, 'signer_role'),
    signedAt: signatureField(link.original, 'signed_at'), createdAt: signatureField(link.original, 'created_at'),
    documentStatus: signatureField(link.document, 'status'),
  })));
}
function signatureFieldLabel(field: SignatureField): string {
  return field.state === 'present' ? field.value! : field.state === 'missing' ? 'Nicht geliefert'
    : field.state === 'null' ? 'Null im Original' : field.state === 'empty' ? `Leer im Original · ${JSON.stringify(field.value)}` : 'Ungeklärtes Originalformat';
}
function SignatureEntry({ entry, mayRead }: { entry: SignatureMetadata; mayRead: () => boolean }) {
  const colors = useAuroraAdaptiveText();
  if (!mayRead()) return null;
  return <PremiumCard style={styles.card}>
    <Text selectable style={[styles.primary, { color: colors.primary }]}>Signaturkennung: {entry.nativeId}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Dokumentkennung: {signatureFieldLabel(entry.documentId)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>{entry.documentLink === 'delivered_document'
      ? 'Native Dokumentkennung im gelieferten Aufnahmedokumentbestand enthalten.' : 'Zuordnung zum gelieferten Aufnahmedokumentbestand ungeklärt.'}</Text>
    <Text selectable style={[styles.primary, { color: colors.primary }]}>Originalname: {signatureFieldLabel(entry.signerName)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Rollenangabe im Original: {signatureFieldLabel(entry.signerRole)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Signaturzeit im Original: {signatureFieldLabel(entry.signedAt)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Erfassungszeit im Original: {signatureFieldLabel(entry.createdAt)}</Text>
    <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Dokumentstatus im Original: {signatureFieldLabel(entry.documentStatus)}</Text>
  </PremiumCard>;
}

/** Private metadata panel. Parent binding and layout acceptance are separate; stored signatures do not grant clinical approval. */
export function ClientRecordSignaturePanel({ captureRead }: Props) {
  const colors = useAuroraAdaptiveText(), [visible, setVisible] = useState(50);
  const latest = useRef(captureRead), alive = useRef(true), owner = useRef<SignatureReadOwner>({ capture: null, ticket: 0, trusted: null });
  latest.current = captureRead;
  const read = captureSignatureRead(captureRead);
  if ((owner.current.capture !== null || read !== null) && !sameSignatureCapture(owner.current.capture, read)) {
    owner.current.ticket++; owner.current.trusted = null;
    owner.current = { capture: read, ticket: 0, trusted: null };
  }
  const generation = owner.current, readKey = read?.key ?? 'no-current-original-read';
  useEffect(() => { alive.current = true; return () => { alive.current = false; owner.current.ticket++; owner.current.trusted = null; }; }, []);
  const currentRead = () => {
    if (!alive.current || owner.current !== generation || !read || !sameSignatureCapture(read, captureSignatureRead(latest.current))) {
      throw Error('Der eigene aktuelle Signatur-Lesebezug wurde ersetzt.');
    }
    assertClientTimelineCapture(read);
  };
  const query = useAsyncQuery(async () => {
    try { currentRead(); } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigener Signaturbestand nicht bestätigt.' }; }
    const ticket = ++generation.ticket;
    generation.trusted = null;
    const assertRead = () => { currentRead(); if (ticket !== generation.ticket) throw Error('Der eigene Signaturabruf wurde ersetzt.'); };
    try {
      assertRead();
      const result = await fetchClientSignatureOriginalReadWeb(read!.tenantId, read!.clientId,
        { canRead: true, canViewSensitive: true, assertCurrentRead: assertRead });
      assertRead();
      if (!result.ok) return result;
      if (result.data.state !== 'requested') throw Error('Der native Signaturbestand wurde nicht angefragt.');
      const entries = signatureMetadata(result.data.collection);
      assertRead();
      const envelope = Object.freeze({ owner: read!.owner, key: readKey, ticket, entries });
      generation.trusted = { envelope, originals: result.data.collection };
      return { ok: true as const, data: envelope };
    } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigener Signaturbestand nicht bestätigt.' }; }
  }, [readKey, read?.owner, generation], { enabled: !!read, queryKey: `private-client-signature-metadata:${readKey}` });
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const projectionData = query.data, projectionTicket = generation.ticket;
  function mayRead(entry?: SignatureMetadata): boolean {
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
    if (generation.ticket !== projectionTicket || latestQuery.current.data !== projectionData || latestQuery.current.loading !== false || latestQuery.current.refreshing !== false) return;
    try { await query.refresh(); } catch { /* The query owns its error state; denied retries do not reject into UI handlers. */ }
  }
  const ownPool = mayRead();
  return <SectionPanel title="Signaturen · Originalmetadaten" subtitle="Gespeicherte Namen, Rollen, Zeit- und Statusangaben bestätigen keine geprüfte Signatur, Durchführung oder fachliche Freigabe.">
    {!read ? <EmptyState title="Signaturmetadaten nicht freigegeben" message="Der aktuelle eigene Zugriff auf sensible Signaturmetadaten ist nicht bestätigt." />
      : query.loading || query.refreshing ? <LoadingState message="Native Signaturmetadaten werden geladen…" />
      : !ownPool ? <ErrorState message={query.error ?? query.refreshError ?? 'Der aktuelle vollständig gelieferte Signaturbestand ist nicht bestätigt.'} onRetry={() => { void retry(); }} />
      : !projectionData!.entries.length ? <EmptyState title="Keine Signaturen im gelieferten Originalbestand" />
      : <View style={styles.panel}>
        <Text style={[styles.secondary, { color: colors.secondary }]}>{projectionData!.entries.length} native Signaturzeilen im gelieferten Bestand</Text>
        {projectionData!.entries.slice(0, visible).map(entry => <SignatureEntry key={entry.nativeId} entry={entry} mayRead={() => mayRead(entry)} />)}
        {projectionData!.entries.length > visible ? <PremiumButton title="Weitere Signaturmetadaten anzeigen" variant="ghost" onPress={() => { if (mayRead()) setVisible(value => value + 50); }} /> : null}
      </View>}
  </SectionPanel>;
}
const styles = StyleSheet.create({ panel: { gap: spacing.md, minWidth: 0 }, card: { gap: spacing.xs, minWidth: 0 },
  primary: { ...typography.body, flexShrink: 1 }, secondary: { ...typography.caption, flexShrink: 1 } });
