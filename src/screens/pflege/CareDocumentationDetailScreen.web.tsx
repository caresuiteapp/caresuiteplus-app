import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CareDocumentationWorkspacePanel } from '@/components/pflege/CareDocumentationWorkspacePanel.web';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareDocumentationScope } from '@/hooks/pflege/useCareDocumentationScope.web';
import { careDocumentationDisplayTime, careDocumentationQueueState } from '@/lib/pflege/careDocumentationQueue.web';
import { readCareDocumentationRecord } from '@/lib/pflege/careDocumentationRepository.supabase.web';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { radius, spacing, typography } from '@/theme';
import { CarePermissionStatus } from './CarePermissionStatus.web';

const changedScope = 'Der Pflegefall oder die Dokumentationsberechtigung wurde geändert.';

export function CareDocumentationDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; clientId?: string | string[] }>();
  const scope = useCareDocumentationScope();
  if (!scope.ready) return <ScreenShell title="Dokumentationsoriginal"><CarePermissionStatus state={scope.permissions} /></ScreenShell>;
  if (!woundUuid(params.id) || !woundUuid(params.clientId)) {
    return <ScreenShell title="Dokumentationsoriginal"><ErrorState presentation="inline"
      message="Der eindeutige Pflegefall- oder Eintragsbezug fehlt. Öffnen Sie den Eintrag aus der Dokumentationsliste." /></ScreenShell>;
  }
  return <DocumentationOriginal key={`${scope.revision}:${params.clientId}:${params.id}`} id={params.id} clientId={params.clientId} scope={scope} />;
}

function DocumentationOriginal({ id, clientId, scope }: {
  id: string; clientId: string; scope: ReturnType<typeof useCareDocumentationScope>;
}) {
  const router = useRouter();
  const { c } = useCareLightPalette();
  const { tenantId, actorId, profile, isCurrent, can } = scope;
  const query = useAsyncQuery(async () => {
    if (!isCurrent()) return { ok: false as const, error: changedScope };
    const result = await readCareDocumentationRecord({ tenantId, clientId, actorId, isCurrent }, id);
    return isCurrent() ? result : { ok: false as const, error: changedScope };
  }, [scope.revision, id, clientId], { queryKey: `pflege-doku-original:${scope.revision}:${clientId}:${id}`, retryCount: 0 });
  const original = !query.error && !query.refreshError && !query.previewData && !query.tableMissing && !query.cacheMeta.fromCache ? query.data : null;
  const refresh = () => { if (isCurrent()) void query.refresh(); };
  const backToList = () => {
    if (isCurrent()) router.replace(`/pflege/dokumentation?clientId=${encodeURIComponent(clientId)}` as never);
  };
  return <ScreenShell title="Dokumentationsoriginal" subtitle="Ereignis, Original und Nachträge prüfen">
    <View style={styles.stack}>
      {query.loading || query.refreshing ? <LoadingState presentation="inline" message="Dokumentationsoriginal wird geprüft …" />
        : !original ? <ErrorState presentation="inline" message={query.error ?? query.refreshError ?? 'Das vollständige Dokumentationsoriginal ist nicht verfügbar.'}
          onRetry={refresh} />
        : <>
          <SectionPanel title={original.payload.title} subtitle={`Fassung ${original.revision} · Ereignis ${careDocumentationDisplayTime(original.occurredAt)}`}>
            <InfoBanner variant="info" presentation="inline" title="Unverändertes Original"
              message={`Erfasst ${careDocumentationDisplayTime(original.recordedAt)} von ${original.recordedByName}. Nachträge erhalten eine eigene Fassung.`} />
            <Text style={[typography.h3, { color: c.text }]}>Beobachtung</Text>
            <Text selectable style={[typography.body, { color: c.text }]}>{original.payload.observation}</Text>
            <Text style={[typography.h3, { color: c.text }]}>Maßnahme</Text>
            <Text selectable style={[typography.body, { color: c.text }]}>{original.payload.intervention || 'Keine eigene Maßnahme dokumentiert.'}</Text>
            <Text style={[typography.h3, { color: c.text }]}>Ergebnis</Text>
            <Text selectable style={[typography.body, { color: c.text }]}>{original.payload.result || 'Kein Ergebnis dokumentiert.'}</Text>
            {original.voided ? <InfoBanner variant="warning" presentation="inline" title="Für ungültig erklärt" message="Dieser Eintrag bleibt als Teil des Verlaufs lesbar." />
              : original.signature && careDocumentationQueueState(original) === 'confirmed' ? <InfoBanner variant="success" presentation="inline"
                title="Inhaltsgebunden bestätigt" message={`${original.signature.personName} · ${original.signature.role} · ${careDocumentationDisplayTime(original.signature.confirmedAt)} · ${original.signature.scope}`} />
              : <InfoBanner variant="warning" presentation="inline" title="Keine inhaltsgebundene Bestätigung"
                message={can('pflege.documentation.sign') ? 'Für diese Fassung ist keine Bestätigung hinterlegt. Neue Inhaltsbestätigungen sind in dieser Ansicht derzeit nicht verfügbar.' : 'Für diese Fassung ist keine Bestätigung hinterlegt.'} />}
          </SectionPanel>
          <SectionPanel title="Original und Nachträge" subtitle={`${original.history.length} unveränderte Fassung(en)`}>
            {original.history.map(item => <View key={item.id} style={[styles.history, { borderColor: c.border }]}>
              <Text style={[typography.h3, { color: c.text }]}>Fassung {item.revision}: {item.payload.title}</Text>
              <Text style={[typography.caption, { color: c.muted }]}>Ereignis {careDocumentationDisplayTime(item.occurredAt)} · erfasst {careDocumentationDisplayTime(item.recordedAt)}</Text>
              <Text selectable style={[typography.body, { color: c.text }]}>{item.payload.observation}</Text>
              {item.correctionReason ? <Text style={[typography.caption, { color: c.muted }]}>Nachtragsgrund: {item.correctionReason}</Text> : null}
            </View>)}
          </SectionPanel>
          {!original.voided && can('pflege.documentation.create') ? <CareDocumentationWorkspacePanel key={`${original.headId}:${original.revision}`}
            tenantId={tenantId} clientId={clientId} actorId={actorId} actorName={profile?.displayName ?? profile?.email ?? 'Aktuelle Person'}
            canCreate canConfirm={false} isOwnerCurrent={isCurrent}
            canWriteNow={() => can('pflege.documentation.create')} original={original} onSaved={refresh} /> : null}
        </>}
      <View style={styles.actions}><PremiumButton title="Zum Verlauf dieses Pflegefalls" variant="secondary" onPress={backToList} /></View>
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, minWidth: 0 },
  history: { padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderRadius: radius.md, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
