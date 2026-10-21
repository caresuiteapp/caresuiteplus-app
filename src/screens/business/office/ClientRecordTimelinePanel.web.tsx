import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { ClientInternalNote } from '@/types/modules/client';
import { fetchClientTimelineOriginalReadWeb } from '@/lib/clients/clientTimelineOriginalRead.web';
import type { ClientTimelineOriginalEntry, ClientTimelineField } from '@/lib/clients/clientTimelineOriginals.web';
import { assertClientTimelineCapture, type ClientTimelineReadCapture, type ClientTimelineNoteCapture, type ClientTimelineNoteControllerStore } from '@/lib/clients/clientTimelineNoteAction.web';
import { writeClientTimelineNoteWeb } from '@/lib/clients/clientTimelineNoteWrite.web';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { spacing, typography } from '@/theme';

export type ClientRecordTimelineAccess = {
  /** Immutable native tenant/client/profile/role identity, not the transient runtime-read key. */
  nativeOwnerKey: string;
  captureRead: () => ClientTimelineReadCapture | null;
  /** Supplied internal-note DTO read retains its existing basic-own-view access, independently of raw metadata and edit rights. */
  captureInternalNotesRead: () => ClientTimelineReadCapture | null;
  captureWrite: () => ClientTimelineNoteCapture | null;
  /** Only currently own, scope-checked delivered DTO notes; no native sidecar is supplied as a prop. */
  internalNotes: readonly ClientInternalNote[];
};
type Props = { access: ClientRecordTimelineAccess; controllers: ClientTimelineNoteControllerStore; onRecordRefresh?: () => Promise<void> | void };
function capture<T extends ClientTimelineReadCapture>(read: () => T | null, write = false): T | null {
  try { const token = read(); if (token) assertClientTimelineCapture(token, write); return token; } catch { return null; }
}
function sameCapture(a: ClientTimelineReadCapture | null, b: ClientTimelineReadCapture | null): boolean {
  return !!a && !!b && a.owner === b.owner && a.key === b.key && a.tenantId === b.tenantId && a.clientId === b.clientId;
}
function originalValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'Nicht geliefert';
  return JSON.stringify(value, (_key, item) => item === undefined ? '[nicht gelieferter Wert]' : item);
}
function fieldLabel(field: ClientTimelineField): string {
  return field.state === 'present' ? originalValue(field.value) : `${field.state === 'missing' ? 'Nicht geliefert' : field.state === 'null' ? 'Null im Original' : field.state === 'empty' ? 'Leer im Original' : 'Ungeklärtes Original'}${field.state === 'invalid' ? ` · ${originalValue(field.value)}` : ''}`;
}
function OriginalEntry({ entry, mayRead }: { entry: ClientTimelineOriginalEntry; mayRead: () => boolean }) {
  const colors = useAuroraAdaptiveText(), [expanded, setExpanded] = useState(false);
  if (!mayRead()) return null;
  return <PremiumCard style={styles.card}>
    <Text style={[styles.primary, { color: colors.primary }]}>{fieldLabel(entry.title)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>{entry.kind} · {entry.nativeId}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Originalzeit: {originalValue(entry.timestamp.value)}{entry.timestamp.state !== 'valid' ? ' · Zeitangabe ungeklärt' : ''}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Autorname: {fieldLabel(entry.originalActorName)} · Autorprofil: {fieldLabel(entry.actorProfileId)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Dokumentkennung: {fieldLabel(entry.documentId)}</Text>
    <Text style={[styles.secondary, { color: colors.secondary }]}>Ereignis-/Statusangaben im Original: {fieldLabel(entry.eventType)} · {fieldLabel(entry.status)}</Text>
    {entry.subtitle.state === 'present' ? <Text style={[styles.primary, { color: colors.primary }]}>{fieldLabel(entry.subtitle)}</Text> : null}
    <PremiumButton title={expanded ? 'Originalbeleg schließen' : 'Originalbeleg öffnen'} size="sm" variant="ghost" onPress={() => { if (mayRead()) setExpanded(value => !value); }} />
    {expanded ? <Text selectable style={[styles.secondary, { color: colors.secondary }]}>{JSON.stringify(entry.original, (_key, value) => value === undefined ? '[nicht gelieferter Wert]' : value, 2)}</Text> : null}
  </PremiumCard>;
}

/** Private standalone panel candidate. Root binds its factories and parent-owned store only after the parent receipt API freezes. */
export function ClientRecordTimelinePanel({ access, controllers, onRecordRefresh }: Props) {
  const colors = useAuroraAdaptiveText(), controller = controllers.forOwner(access.nativeOwnerKey);
  const [, invalidate] = useState(0), [visible, setVisible] = useState(50);
  const latest = useRef({ access, controller, onRecordRefresh }), alive = useRef(true), flight = useRef(0);
  latest.current = { access, controller, onRecordRefresh };
  useEffect(() => controller.subscribe(() => invalidate(value => value + 1)), [controller]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; flight.current++; }; }, []);
  const read = capture(access.captureRead), notesRead = capture(access.captureInternalNotesRead), write = capture(access.captureWrite, true), state = controller.snapshot();
  const readKey = read ? `${access.nativeOwnerKey}:${read.key}` : `${access.nativeOwnerKey}:no-original-read`;
  const query = useAsyncQuery(async () => {
    if (!read) return { ok: false as const, error: 'Der Zugriff auf native Verlaufsoriginale ist nicht bestätigt.' };
    // Reject retained old fetchers before they can supersede a fresh current-owner request.
    if (!alive.current || latest.current.controller !== controller || !sameCapture(read, capture(latest.current.access.captureRead))) {
      return { ok: false as const, error: 'Der eigene native Verlaufsabruf wurde ersetzt.' };
    }
    const attempt = ++flight.current;
    const assertRead = () => {
      if (!alive.current || flight.current !== attempt || latest.current.controller !== controller
        || !sameCapture(read, capture(latest.current.access.captureRead))) throw Error('Der eigene native Verlaufsabruf wurde ersetzt.');
      assertClientTimelineCapture(read);
    };
    try {
      assertRead();
      const result = await fetchClientTimelineOriginalReadWeb(read.tenantId, read.clientId, { canRead: true, canViewSensitive: true, assertCurrentRead: assertRead });
      assertRead();
      return result.ok ? { ok: true as const, data: { key: readKey, owner: read.owner, receipt: result.data } } : result;
    } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : 'Originalverlauf nicht bestätigt.' }; }
  }, [readKey, read?.owner], { enabled: !!read, queryKey: `private-client-native-timeline:${readKey}` });
  const latestQuery = useRef(query);
  latestQuery.current = query;
  async function save() {
    if (!alive.current || latest.current.controller !== controller || !sameCapture(write, capture(latest.current.access.captureWrite, true))) return;
    const attempt = write && controller.begin(write, state.version);
    if (!attempt) return;
    const outcome = controller.finish(attempt, await writeClientTimelineNoteWeb(attempt));
    if (!outcome.mayFollowup || !alive.current || latest.current.controller !== controller) return;
    try {
      assertClientTimelineCapture(attempt.capture, true);
      await query.refresh();
      assertClientTimelineCapture(attempt.capture, true);
      await latest.current.onRecordRefresh?.();
    } catch { /* Known acknowledgement remains in the external controller; no automatic write retry. */ }
  }
  const projectionFlight = flight.current, projectionData = query.data;
  function mayReadOriginal(entry?: ClientTimelineOriginalEntry): boolean {
    const current = latestQuery.current;
    return alive.current && latest.current.controller === controller && sameCapture(read, capture(latest.current.access.captureRead))
      && flight.current === projectionFlight && current.data === projectionData && !!read
      && current.data?.key === readKey && current.data.owner === read.owner
      && !current.loading && !current.refreshing && !current.error && !current.refreshError && !current.previewData && !current.tableMissing
      && !current.cacheMeta.fromCache && !current.cacheMeta.partialDetail && (!entry || current.data.receipt.entries.includes(entry));
  }
  const ownPool = !!read && query.data?.key === readKey && query.data.owner === read.owner
    && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing
    && !query.cacheMeta.fromCache && !query.cacheMeta.partialDetail;
  return <View style={styles.panel}>
    <SectionPanel title="Verlauf / Timeline" subtitle="Native Originalbelege. Ereignis- und Statuswörter bestätigen keine Durchführung, Freigabe oder geprüfte Signatur.">
      {!read ? <EmptyState title="Verlaufsoriginale nicht freigegeben" message="Der aktuelle Zugriff auf sensible Verlaufsmetadaten ist nicht bestätigt." />
        : query.loading || query.refreshing ? <LoadingState message="Native Verlaufsoriginale werden geladen…" />
        : !ownPool ? <ErrorState message={query.error ?? query.refreshError ?? 'Der aktuelle vollständige Originalverlauf ist nicht bestätigt.'} onRetry={() => { if (sameCapture(read, capture(latest.current.access.captureRead))) void query.refresh(); }} />
        : !query.data!.receipt.entries.length ? <EmptyState title="Keine Einträge im gelieferten Originalbestand" />
        : <View style={styles.panel}>{query.data!.receipt.entries.slice(0, visible).map(entry => <OriginalEntry key={entry.key} entry={entry} mayRead={() => mayReadOriginal(entry)} />)}
          {query.data!.receipt.entries.length > visible ? <PremiumButton title="Weitere Originalbelege anzeigen" variant="ghost" onPress={() => { if (mayReadOriginal()) setVisible(value => value + 50); }} /> : null}</View>}
    </SectionPanel>
    {notesRead && access.internalNotes.length ? <SectionPanel title="Interne Notizen" subtitle="Nur Office — nicht im Portal">
      {access.internalNotes.map(note => <PremiumCard key={note.id} accentColor={careSuiteAuroraTheme.accent.violet} style={styles.card}>
        <Text style={[styles.secondary, { color: colors.secondary }]}>{note.category} · {note.createdBy} · {note.id}</Text>
        <Text style={[styles.primary, { color: colors.primary }]}>{note.content}</Text>
        <Text style={[styles.secondary, { color: colors.secondary }]}>Erfasst: {note.createdAt} · Geändert: {note.updatedAt}</Text>
      </PremiumCard>)}
    </SectionPanel> : null}
    {write ? <SectionPanel title="Eintrag hinzufügen">
      <PremiumInput label="Notiz" value={state.draft} multiline editable={!state.busy && !state.uncertain} onChangeText={value => {
        if (alive.current && latest.current.controller === controller && sameCapture(write, capture(latest.current.access.captureWrite, true))) controller.change(value, state.version);
      }} />
      <PremiumButton title="Eintrag speichern" loading={state.busy} disabled={state.busy || state.uncertain || !state.draft.trim()} onPress={save} />
    </SectionPanel> : null}
    {state.error ? <ErrorState message={read || write ? state.error : state.uncertain
      ? 'Eine eigene Notizspeicherung bleibt ungewiss. Sie wird nicht automatisch wiederholt.'
      : 'Der eigene Notizstatus bleibt erhalten. Der aktuelle Aktenzugriff ist nicht bestätigt.'} /> : null}
  </View>;
}
const styles = StyleSheet.create({ panel: { gap: spacing.md, minWidth: 0 }, card: { gap: spacing.xs, minWidth: 0 },
  primary: { ...typography.body, flexShrink: 1 }, secondary: { ...typography.caption, flexShrink: 1 } });
