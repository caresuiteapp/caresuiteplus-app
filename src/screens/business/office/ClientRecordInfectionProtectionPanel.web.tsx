import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { assertClientTimelineCapture, type ClientTimelineReadCapture } from '@/lib/clients/clientTimelineNoteAction.web';
import { fetchClientInfectionProtectionOriginalReadWeb } from '@/lib/clients/clientInfectionProtectionOriginalRead.web';
import type { ClientInfectionProtectionEntryWeb, ClientInfectionProtectionEvidenceWeb, ClientInfectionProtectionFieldWeb } from '@/lib/clients/clientInfectionProtectionEvidence.web';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type Props = { captureRead: () => ClientTimelineReadCapture | null };
type Envelope = Readonly<{ owner: object; key: string; ticket: number; entries: readonly ClientInfectionProtectionEntryWeb[] }>;
type Owner = { capture: ClientTimelineReadCapture | null; ticket: number; trusted: { envelope: Envelope; originals: ClientInfectionProtectionEvidenceWeb } | null };

function captureSensitiveRead(factory: Props['captureRead']): ClientTimelineReadCapture | null {
  try {
    const value = factory();
    if (!value || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = ['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead'];
    if (Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some((key) =>
      typeof key !== 'string' || !keys.includes(key) || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) return null;
    const captured = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(value, key)!.value])) as ClientTimelineReadCapture;
    if (!captured.owner || Object.getPrototypeOf(captured.owner) !== Object.prototype
      || !Object.isFrozen(captured.owner) || Reflect.ownKeys(captured.owner).length) return null;
    assertClientTimelineCapture(captured);
    return Object.freeze(captured);
  } catch { return null; }
}

function sameCapture(left: ClientTimelineReadCapture | null, right: ClientTimelineReadCapture | null): boolean {
  return !!left && !!right && left.owner === right.owner && left.key === right.key
    && left.tenantId === right.tenantId && left.clientId === right.clientId;
}

function label(field: ClientInfectionProtectionFieldWeb): string {
  return field.state === 'value' ? field.value! : field.state === 'missing' ? 'Nicht geliefert'
    : field.state === 'undefined' ? 'Ungeklärter eigener Feldwert' : field.state === 'null' ? 'NULL im Original'
    : field.state === 'empty' ? 'Leer im Original' : 'Originalformat ungeklärt';
}

/** Sensitive original excerpt; never a diagnosis, isolation decision or task completion. */
export function ClientRecordInfectionProtectionPanel({ captureRead }: Props) {
  const colors = useAuroraAdaptiveText();
  const latest = useRef(captureRead), alive = useRef(true);
  const owner = useRef<Owner>({ capture: null, ticket: 0, trusted: null });
  latest.current = captureRead;
  const read = captureSensitiveRead(captureRead);
  if ((owner.current.capture !== null || read !== null) && !sameCapture(owner.current.capture, read)) {
    owner.current.ticket++;
    owner.current.trusted = null;
    owner.current = { capture: read, ticket: 0, trusted: null };
  }
  const generation = owner.current, readKey = read?.key ?? 'no-current-infection-protection-read';
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; owner.current.ticket++; owner.current.trusted = null; };
  }, []);
  const currentRead = () => {
    if (!alive.current || owner.current !== generation || !read || !sameCapture(read, captureSensitiveRead(latest.current))) {
      throw Error('Der eigene aktuelle Infektionsschutz-Lesebezug wurde ersetzt.');
    }
    assertClientTimelineCapture(read);
  };
  const query = useAsyncQuery(async () => {
    try { currentRead(); } catch (cause) {
      return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Infektionsschutzangaben nicht bestätigt.' };
    }
    const ticket = ++generation.ticket;
    generation.trusted = null;
    const assertRead = () => {
      currentRead();
      if (ticket !== generation.ticket) throw Error('Der eigene Infektionsschutzabruf wurde ersetzt.');
    };
    try {
      const result = await fetchClientInfectionProtectionOriginalReadWeb(read!.tenantId, read!.clientId,
        { canRead: true, canViewSensitive: true, assertCurrentRead: assertRead });
      assertRead();
      if (!result.ok) return result;
      if (result.data.state !== 'requested') return {ok:false as const,error:'Der vollständige eigene Originalbestand wurde nicht angefordert.'};
      const envelope = Object.freeze({ owner: read!.owner, key: readKey, ticket, entries: result.data.collection.entries });
      generation.trusted = { envelope, originals: result.data.collection };
      return { ok: true as const, data: envelope };
    } catch (cause) {
      return { ok: false as const, error: cause instanceof Error ? cause.message : 'Eigene Infektionsschutzangaben nicht bestätigt.' };
    }
  }, [readKey, read?.owner, generation], { enabled: !!read, queryKey: `private-client-infection-protection:${readKey}` });
  const latestQuery = useRef(query); latestQuery.current = query;
  const projectionData = query.data, projectionTicket = generation.ticket;
  function mayRead(entry?: ClientInfectionProtectionEntryWeb): boolean {
    try { currentRead(); } catch { return false; }
    const current = latestQuery.current;
    return generation.ticket === projectionTicket && !!projectionData && current.data === projectionData
      && generation.trusted?.envelope === projectionData && projectionData.owner === read!.owner && projectionData.key === readKey
      && projectionData.ticket === generation.ticket && current.loading === false && current.refreshing === false
      && current.error === null && current.refreshError === null && current.previewData === false
      && current.tableMissing === false && current.cacheMeta?.fromCache === false
      && (current.cacheMeta.partialDetail === undefined || current.cacheMeta.partialDetail === false)
      && (!entry || projectionData.entries.includes(entry));
  }
  async function retry() {
    try { currentRead(); } catch { return; }
    if (generation.ticket !== projectionTicket || latestQuery.current.data !== projectionData
      || latestQuery.current.loading || latestQuery.current.refreshing) return;
    try { await query.refresh(); } catch { /* query owns its error state */ }
  }
  const ownPool = mayRead();
  return <SectionPanel title="MRE- und Infektionsschutz · Originalhinweise" subtitle="Sensible Freitextangaben; keine automatische Status- oder Maßnahmenableitung">
    {!read ? <EmptyState title="Infektionsschutzangaben nicht freigegeben" message="Der aktuelle eigene sensible Aktenzugriff ist nicht bestätigt." />
      : query.loading || query.refreshing ? <LoadingState message="Native Infektionsschutzangaben werden geladen…" />
      : !ownPool ? <ErrorState message={query.error ?? query.refreshError ?? 'Der aktuelle vollständig gelieferte Infektionsschutzbestand ist nicht bestätigt.'} onRetry={() => { void retry(); }} />
      : !projectionData!.entries.length ? <EmptyState title="Keine ambulante Detailzeile im gelieferten Bestand" message="Dies bestätigt weder fehlenden Verdacht noch fehlenden Befund oder Schutzbedarf." />
      : <View style={styles.list}>{projectionData!.entries.map((entry) => mayRead(entry) ? <PremiumCard key={entry.nativeId} style={styles.card}>
        <Text selectable style={[styles.primary, { color: colors.primary }]}>Native Detailkennung: {entry.nativeId}</Text>
        <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Infektionshinweis · Originaltext: {label(entry.infectionNotes)}</Text>
        <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Hygienehinweis · Originaltext: {label(entry.hygieneNotes)}</Text>
        <Text selectable style={[styles.secondary, { color: colors.secondary }]}>Allgemeine Zeilenmetadaten: erstellt {label(entry.createdAt)} · geändert {label(entry.updatedAt)}</Text>
        <Text style={[styles.warning, { color: colors.secondary }]}>Verdacht und bestätigter Befund sind im aktuellen Schema nicht getrennt. Quelle und konkrete Schutzmaßnahmen sind nicht nativ zugeordnet; die allgemeine Änderungszeit ist keine klinische Erhebungs- oder Gültigkeitszeit.</Text>
        <Text style={[styles.warning, { color: colors.secondary }]}>Freitext, Diagnosebegriffe, Reihenfolge oder Zeitstempel bestätigen weder MRE-/Infektionsstatus noch Isolation, Einsatzfreigabe, Durchführung oder Abschluss.</Text>
      </PremiumCard> : null)}</View>}
  </SectionPanel>;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, minWidth: 0 },
  card: { gap: spacing.xs, minWidth: 0 },
  primary: { ...typography.body, flexShrink: 1 },
  secondary: { ...typography.caption, flexShrink: 1 },
  warning: { ...typography.caption, flexShrink: 1, fontWeight: '600' },
});
