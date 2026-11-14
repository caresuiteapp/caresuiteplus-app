import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCarePlanDailyScope } from '@/hooks/pflege/useCarePlanDailyScope';
import { useLocalMinute } from '@/hooks/useLocalMinute';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { colors, spacing, typography } from '@/theme';
import { fetchLiveCareMeasures } from '@/lib/pflege/careQualityR2LiveService';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { canReviewMeasure, groupVisibleMeasures, MEASURE_WORK_FILTERS, measureMatchesWork, measureWorkFilter, storedDateLabel, type MeasureWorkFilter } from '@/lib/pflege/carePlanDailyWorklist';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { CareMeasureLiveItem } from '@/types/modules/pflege';

const title = 'Maßnahmen';
const batchSize = 24;
const accessError = 'Der Zugriff auf die Maßnahmen des aktuellen Pflegeplans ist nicht bestätigt.';
const statuses = { active: 'Aktiv', paused: 'Pausiert', completed: 'Abgeschlossen', cancelled: 'Abgebrochen' } as const;

export function CareMeasuresWorkspaceScreen() {
  const params = useLocalSearchParams<{ planId?: string; clientId?: string; filter?: string }>();
  const planId = woundUuid(params.planId) ? params.planId : undefined;
  const clientId = woundUuid(params.clientId) ? params.clientId : undefined;
  const invalid = (params.planId !== undefined && !planId) || (params.clientId !== undefined && !clientId);
  const initialFilter = measureWorkFilter(params.filter);
  const scope = useCarePlanDailyScope(JSON.stringify([planId, clientId, invalid, initialFilter]));
  if (scope.access.loading) return <ScreenShell title={title}><LoadingState message="Pflegeberechtigungen werden geprüft…" /></ScreenShell>;
  if (scope.access.error || !scope.allowed) return <ScreenShell title={title}><ErrorState message={scope.access.error ?? accessError}
    onRetry={scope.access.error ? scope.access.refreshPermissions : undefined} /></ScreenShell>;
  if (invalid) return <ScreenShell title={title}><ErrorState message="Der Pflegeplan- oder Klientenbezug im Link ist ungültig." /></ScreenShell>;
  return <MeasuresWorkspace key={scope.revision} scope={scope} planId={planId} clientId={clientId} initialFilter={initialFilter} />;
}

function MeasuresWorkspace({ scope, planId, clientId, initialFilter }: {
  scope: ReturnType<typeof useCarePlanDailyScope>; planId?: string; clientId?: string; initialFilter: MeasureWorkFilter;
}) {
  const router = useFlowRouter();
  const { c } = useCareLightPalette();
  const minute = useLocalMinute();
  const day = berlinCalendarDate(minute ?? new Date());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [visible, setVisible] = useState(batchSize);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const query = useAsyncQuery(() => {
    if (!scope.isCurrent() || !scope.tenantId) return Promise.resolve({ ok: false as const, error: accessError });
    return fetchLiveCareMeasures(scope.tenantId, scope.access.roleKey, { planId, clientId, permissions: scope.access.permissions, isCurrent: scope.isCurrent });
  }, [planId, clientId, scope.revision], { queryKey: `care-measures:${scope.revision}`, retryCount: 0 });

  const ready = scope.isCurrent() && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing;
  const pool = ready ? query.data : null;
  const count = (work: MeasureWorkFilter) => pool?.filter(row => measureMatchesWork(row, work, day)).length;
  const list = useMemo(() => {
    const needles = search.toLocaleLowerCase('de').trim().split(/\s+/).filter(Boolean);
    return groupVisibleMeasures((pool ?? []).filter(row => {
      if (!measureMatchesWork(row, filter, day)) return false;
      const available = [row.title, row.clientName, row.planTitle, row.responsibleRole].join(' ').toLocaleLowerCase('de');
      return needles.every(needle => available.includes(needle));
    }), day);
  }, [pool, search, filter, day]);
  const current = useRef({ scope, pool, list, visible, search, filter, ready });
  current.current = { scope, pool, list, visible, search, filter, ready };
  const open = (row: CareMeasureLiveItem, action: 'plan' | 'review') => {
    const latest = current.current;
    if (!scope.isCurrent() || !latest.scope.isCurrent() || !latest.ready || !latest.list.slice(0, latest.visible).includes(row)) return;
    if (action === 'plan' && woundUuid(row.carePlanId)) router.push(`/pflege/plans/${row.carePlanId}` as never);
    else if (action === 'review' && latest.scope.can('pflege.measures.review') && canReviewMeasure(row)) {
      router.push({ pathname: '/pflege/massnahme-review', params: { id: row.id } });
    }
  };
  const applyFilter = (value: MeasureWorkFilter) => {
    if (!scope.isCurrent()) return;
    setFilter(value); setVisible(batchSize); setExpandedId(null);
  };
  const applySearch = (value: string) => {
    if (!scope.isCurrent()) return;
    setSearch(value); setVisible(batchSize); setExpandedId(null);
  };
  const refresh = () => {
    if (!scope.isCurrent()) return;
    setExpandedId(null);
    void query.refresh();
  };
  const openAll = () => { if (scope.isCurrent()) router.replace('/pflege/massnahmen' as never); };
  const options = MEASURE_WORK_FILTERS.map(option => ({ key: option.key, label: pool ? `${option.label} (${count(option.key)})` : option.label }));
  const activeParent = (row: CareMeasureLiveItem) => ['active', 'aktiv'].includes(row.planStatus);

  return <ScreenShell title={title} subtitle="Pflegeplan-Maßnahmen und hinterlegte Evaluationstermine" scroll={false}>
    {query.loading || query.refreshing ? <LoadingState message="Maßnahmen werden geladen…" /> : null}
    {!query.loading && !query.refreshing && !pool ? <ErrorState message={query.refreshError ?? query.error ?? accessError} onRetry={refresh} /> : null}
    {pool ? <FlatList
      data={list.slice(0, visible)}
      keyExtractor={item => item.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.group}>
        <View style={styles.actions}>
          <PremiumButton title="Maßnahmen aktualisieren" size="sm" variant="secondary" onPress={refresh} />
          {(planId || clientId) ? <PremiumButton title="Alle Maßnahmen öffnen" size="sm" variant="ghost" onPress={openAll} /> : null}
        </View>
        {planId || clientId ? <Text style={[styles.body, { color: c.muted }]}>{planId ? 'Pflegeplan' : 'Klientenakte'}: {pool[0] ? planId ? pool[0].planTitle : pool[0].clientName : 'Ausgewählter Bezug'}</Text> : null}
        <PremiumInput label="Maßnahmen suchen" placeholder="Maßnahme, Klient:in, Pflegeplan oder Rolle" value={search} onChangeText={applySearch}
          hint={`${list.length} von ${pool.length} Maßnahmen`} />
        <Text style={[styles.label, { color: c.text }]}>Status und Evaluationstermine</Text>
        <FilterChipGroup wrap options={options} value={filter} onChange={applyFilter} />
        <Text style={[styles.body, { color: c.muted }]}>Termine werden für aktive Maßnahmen in aktiven Plänen gezählt. Ein Termin zeigt eine vorgesehene Evaluation, keine bestätigte Durchführung.</Text>
      </View>}
      ListEmptyComponent={<EmptyState title={pool.length ? 'Keine Treffer' : 'Keine lesbaren Maßnahmen'}
        message={pool.length ? 'Zur Auswahl passen keine der geladenen Maßnahmen.' : 'Für diesen Bereich wurden keine Maßnahmen gefunden.'}
        actionLabel={pool.length ? 'Filter zurücksetzen' : undefined} onAction={pool.length ? () => { applySearch(''); applyFilter('all'); } : undefined} />}
      ListFooterComponent={list.length > visible ? <PremiumButton title="Weitere Maßnahmen anzeigen" variant="secondary" onPress={() => {
        if (scope.isCurrent() && current.current.pool === pool && current.current.list === list) setVisible(value => value + batchSize);
      }} /> : null}
      renderItem={({ item }) => {
        const canReview = scope.can('pflege.measures.review') && canReviewMeasure(item);
        const expanded = item.id === expandedId;
        return <PremiumCard style={styles.card}>
          <View style={styles.rowTitle}>
            <Text style={[styles.title, { color: c.text }]}>{item.title || 'Maßnahme ohne Titel'}</Text>
            <PremiumBadge label={statuses[item.status]} variant={item.status === 'active' ? 'green' : item.status === 'paused' ? 'orange' : 'muted'} />
          </View>
          <Text style={[styles.body, { color: c.muted }]}>{item.clientName} · {item.planTitle || 'Pflegeplan ohne Titel'}</Text>
          <Text style={[styles.label, { color: c.text }]}>Evaluation: {storedDateLabel(item.nextEvaluationAt)}{measureMatchesWork(item, 'due', day) ? ' · Termin erreicht' : ''}</Text>
          {!activeParent(item) ? <Text style={[styles.body, { color: c.muted }]}>Der zugehörige Plan hat keinen aktiven Status.</Text> : null}
          <View style={styles.actions}>
            <PremiumButton title={expanded ? 'Angaben ausblenden' : 'Gespeicherte Angaben'} accessibilityLabel={`${item.title}: ${expanded ? 'Angaben ausblenden' : 'Gespeicherte Angaben öffnen'}`}
              variant="ghost" size="sm" onPress={() => { if (scope.isCurrent() && current.current.list.includes(item)) setExpandedId(expanded ? null : item.id); }} />
            <PremiumButton title="Pflegeplan öffnen" accessibilityLabel={`${item.title}: Pflegeplan öffnen`} variant="ghost" size="sm" onPress={() => open(item, 'plan')} />
            {canReview ? <PremiumButton title="Evaluation erfassen" accessibilityLabel={`${item.title}: Evaluation erfassen`} size="sm" onPress={() => open(item, 'review')} /> : null}
          </View>
          {expanded ? <View style={[styles.details, { borderColor: colors.borderStrong }]}>
            <Text style={[styles.body, { color: c.text }]}>Durchführung: {item.intervention || 'Nicht erfasst'}</Text>
            <Text style={[styles.body, { color: c.text }]}>Häufigkeit: {item.frequency || 'Nicht erfasst'}</Text>
            <Text style={[styles.body, { color: c.text }]}>Zuständige Rolle: {item.responsibleRole || 'Nicht erfasst'}</Text>
          </View> : null}
        </PremiumCard>;
      }}
    /> : null}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl }, group: { gap: spacing.sm },
  actions: { gap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
  card: { gap: spacing.sm }, details: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  rowTitle: { gap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.bodyStrong, flexShrink: 1 }, label: { ...typography.label }, body: { ...typography.body },
});
