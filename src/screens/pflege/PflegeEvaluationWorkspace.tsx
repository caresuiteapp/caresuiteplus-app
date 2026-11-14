import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareAdaptiveTokens } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchCarePlanEvaluations } from '@/lib/pflege/careQualityLiveService';
import { evaluationOutcomeText, evaluationReviewReached, filterEvaluations, latestEvaluationIds, qualityWorklistDate, qualityWorklistId, type EvaluationFilter } from '@/lib/pflege/pflegeQualityWorklist';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { radius, spacing } from '@/theme';

const route = '/pflege/evaluation';
const batch = 24;
const filters: { key: EvaluationFilter; label: string }[] = [
  { key: 'all', label: 'Alle Evaluationen' }, { key: 'update', label: 'Fortschreibung vermerkt' }, { key: 'review', label: 'Folgetermin erreicht' },
];

export function PflegeEvaluationWorkspace() {
  const router = useRouter();
  const params = useLocalSearchParams<{ carePlanId?: string }>();
  const planId = qualityWorklistId(params.carePlanId);
  const access = useCareRuntimePermissions();
  const { profile, session } = useAuth();
  const tenantId = access.tenantId;
  const allowed = !!tenantId && profile?.tenantId === tenantId && canShowDesktopCatalogRoute(route, access);
  const latest = useRef({ token: session?.accessToken, profile: profile?.id, access, planId, allowed, revision: 0 });
  const last = latest.current;
  const changed = last.token !== session?.accessToken || last.profile !== profile?.id || last.access.tenantId !== tenantId
    || last.access.permissions !== access.permissions || last.allowed !== allowed || last.planId !== planId;
  latest.current = { token: session?.accessToken, profile: profile?.id, access, planId, allowed, revision: last.revision + Number(changed) };
  const revision = latest.current.revision;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => mounted.current && latest.current.revision === revision && latest.current.allowed && canShowDesktopCatalogRoute(route, latest.current.access);

  return <ScreenShell title="Evaluationen" subtitle="Wirkung nachvollziehen und vereinbarte Prüftermine finden">
    {access.loading ? <LoadingState presentation="inline" message="Berechtigungen werden geprüft …" />
      : access.error ? <ErrorState presentation="inline" message={access.error} onRetry={access.refreshPermissions} />
      : !allowed || !tenantId ? <ErrorState presentation="inline" message="Für dieses Konto sind keine Pflegeevaluationen freigegeben." />
      : planId === null ? <ErrorState presentation="inline" message="Der verlinkte Pflegeplan ist ungültig." onRetry={() => { if (isCurrent()) router.replace(route as never); }} />
      : <EvaluationWorklist key={revision} tenantId={tenantId} planId={planId} access={access} isCurrent={isCurrent} />}
  </ScreenShell>;
}

function EvaluationWorklist({ tenantId, planId, access, isCurrent }: {
  tenantId: string; planId?: string; access: ReturnType<typeof useCareRuntimePermissions>; isCurrent: () => boolean;
}) {
  const router = useRouter();
  const { c, typography } = useCareAdaptiveTokens();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EvaluationFilter>('all');
  const [limit, setLimit] = useState(batch);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useAsyncQuery(() => fetchCarePlanEvaluations(tenantId, access.roleKey, { carePlanId: planId, permissionContext: { effectivePermissions: access.permissions }, isCurrent }), [tenantId, planId], { retryCount: 0 });
  const data = !query.previewData && !query.tableMissing ? query.data : null;
  const now = Date.now();
  const visible = filterEvaluations(data ?? [], filter, search, now);
  const latest = useMemo(() => latestEvaluationIds(data ?? []), [data]);
  const canOpenPlan = canShowDesktopCatalogRoute('/pflege/plans', access);
  const canCreate = access.can('pflege.evaluations.manage') && canOpenPlan;
  const summary = data ? `${visible.length} von ${data.length} Evaluationen` : undefined;
  function resetRows() { setLimit(batch); setExpanded(null); }
  return <View style={styles.content}>
    <SectionPanel title="Evaluationen durchsuchen" subtitle={summary}>
      <View style={styles.tools}>
        {planId ? <InfoBanner variant="info" presentation="inline" title="Auswahl: verlinkter Pflegeplan" message="Es werden nur Evaluationen dieses Plans abgefragt." /> : null}
        <PremiumInput label="Nach Person, Pflegeplan oder Ergebnis suchen" value={search} onChangeText={v => { setSearch(v); resetRows(); }} />
        <FilterChipGroup<EvaluationFilter> options={filters} value={filter} wrap onChange={v => { setFilter(v); resetRows(); }} />
        <View style={styles.actions}>
          {planId ? <PremiumButton title="Alle Pflegepläne berücksichtigen" variant="ghost" onPress={() => { if (isCurrent()) router.replace(route as never); }} /> : null}
          <PremiumButton title="Aktualisieren" variant="secondary" loading={query.refreshing} onPress={() => { if (isCurrent()) void query.refresh(); }} />
          {canCreate ? <PremiumButton title="Evaluation dokumentieren" onPress={() => {
            if (isCurrent() && access.can('pflege.evaluations.manage') && canShowDesktopCatalogRoute('/pflege/plans', access)) router.push((planId ? `${route}/new?carePlanId=${planId}` : `${route}/new`) as never);
          }} /> : null}
        </View>
      </View>
    </SectionPanel>
    {query.loading && !data ? <LoadingState presentation="inline" message="Evaluationen werden geladen …" /> : null}
    {query.error ? <ErrorState presentation="inline" message={query.error} onRetry={() => { if (isCurrent()) void query.refresh(); }} /> : null}
    {query.refreshError ? <InfoBanner variant="warning" presentation="inline" title="Aktualisierung fehlgeschlagen" message="Die Liste zeigt den zuletzt geladenen Stand." /> : null}
    {data ? <SectionPanel title="Dokumentierte Evaluationen" subtitle="Die Termin- und Fortschreibungsfilter beziehen sich jeweils auf die letzte geladene Evaluation eines Plans.">
      {!visible.length ? <EmptyState title={data.length ? 'Keine passenden Evaluationen' : 'Keine Evaluationen gefunden'} message={data.length ? 'Ändern Sie die Suche oder den Filter.' : 'Für diese Auswahl sind keine Evaluationen gespeichert.'} /> : null}
      <View style={styles.list}>
        {visible.slice(0, limit).map(row => {
          const open = expanded === row.id;
          const date = qualityWorklistDate(row.evaluatedAt);
          const next = qualityWorklistDate(row.nextEvaluationAt);
          return <View key={row.id} style={[styles.card, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <View style={styles.main}>
              <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{row.planTitle}</Text>
              <Text style={[typography.body, { color: c.text }]}>{row.clientName === '—' ? 'Name nicht verfügbar' : row.clientName} · {evaluationOutcomeText(row.outcome)}</Text>
              <Text style={[typography.caption, { color: c.muted }]}>{date ? `Evaluiert am ${date}` : 'Evaluationsdatum nicht verfügbar'}{next ? ` · Folgetermin ${next}` : ''}</Text>
              {latest.has(row.id) && (row.requiresPlanUpdate || evaluationReviewReached(row, now)) ? <Text style={[typography.caption, { color: c.text }]}>{[row.requiresPlanUpdate && 'Fortschreibung vermerkt', evaluationReviewReached(row, now) && 'Folgetermin erreicht'].filter(Boolean).join(' · ')}</Text> : null}
            </View>
            <View style={styles.actions}>
              <PremiumButton size="sm" variant="secondary" title={open ? 'Details ausblenden' : 'Details anzeigen'} onPress={() => { if (isCurrent()) setExpanded(open ? null : row.id); }} />
              {canOpenPlan && qualityWorklistId(row.carePlanId) ? <PremiumButton size="sm" variant="ghost" title="Pflegeplan öffnen" onPress={() => {
                if (isCurrent() && canShowDesktopCatalogRoute('/pflege/plans', access)) router.push(`/pflege/plans/${row.carePlanId}` as never);
              }} /> : null}
            </View>
            {open ? <View style={styles.main}>
              <Text style={[typography.caption, { color: c.muted }]}>Dokumentiert durch: {row.evaluatorName}</Text>
              <Text style={[typography.body, { color: c.text }]}>Beobachtete Wirkung: {row.observedEffect || 'Keine Angabe'}</Text>
              <Text style={[typography.body, { color: c.text }]}>Fachliche Schlussfolgerung: {row.professionalConclusion || 'Keine Angabe'}</Text>
            </View> : null}
          </View>;
        })}
      </View>
      {visible.length > limit ? <PremiumButton size="sm" variant="secondary" title="Weitere Evaluationen anzeigen" onPress={() => setLimit(limit + batch)} /> : null}
    </SectionPanel> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl }, tools: { gap: spacing.md, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, list: { gap: spacing.sm },
  main: { gap: spacing.xs, minWidth: 0 }, card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, minWidth: 0 },
});
