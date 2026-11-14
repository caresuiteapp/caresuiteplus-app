import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareAdaptiveTokens } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchMdReadiness } from '@/lib/pflege/careQualityR2LiveService';
import { filterMdEvidenceCases, groupMdEvidenceCases, mdEvidenceChecks, mdEvidenceTarget, type MdEvidenceFilter, type MdEvidenceTarget } from '@/lib/pflege/mdEvidenceWorkspace';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { radius, spacing } from '@/theme';
import type { PflegeMdReadinessItem } from '@/types/modules/pflege';

const title = 'MD-Prüfbereitschaft';
const mdRoute = '/pflege/md-pruefbereitschaft';
const loadScopeError = 'Der aktuelle Zugriff auf die Nachweise ist nicht bestätigt.';
const batchSize = 30;
const filters: { key: MdEvidenceFilter; label: string }[] = [
  { key: 'pending', label: 'Mit offenen Prüfpunkten' },
  { key: 'matched', label: 'Ohne offene Prüfpunkte' },
  { key: 'all', label: 'Alle Pflegefälle' },
];

type CareAccess = ReturnType<typeof useCareRuntimePermissions>;

export function MdReadinessListScreen() {
  const { profile, user, session, portalSession, authReady, isAuthenticated, isLoading, profileBootstrapError } = useAuth();
  const access = useCareRuntimePermissions();
  const tenantId = access.tenantId;
  const token = session?.accessToken;
  const expires = session?.expiresAt;
  const allowedNow = () => woundUuid(tenantId) && woundUuid(profile?.id) && woundUuid(user?.id) && !!token
    && session?.user.id === user.id && authReady && isAuthenticated && !isLoading && !profileBootstrapError && !portalSession
    && profile?.tenantId === tenantId && profile?.roleKey === access.roleKey
    && (expires === null || typeof expires === 'number' && expires > Date.now())
    && canShowDesktopCatalogRoute(mdRoute, access);
  const allowed = allowedNow();
  const scope = useRef({ generation: 0, tenantId, actorId: profile?.id, userId: user?.id, role: access.roleKey, permissions: access.permissions, token, expires, allowed });
  const prior = scope.current;
  if (prior.tenantId !== tenantId || prior.actorId !== profile?.id || prior.userId !== user?.id || prior.role !== access.roleKey
    || prior.permissions !== access.permissions || prior.token !== token || prior.expires !== expires || prior.allowed !== allowed) {
    scope.current = { generation: prior.generation + 1, tenantId, actorId: profile?.id, userId: user?.id, role: access.roleKey, permissions: access.permissions, token, expires, allowed };
  }
  const captured = scope.current;
  const latest = useRef(allowedNow);
  latest.current = allowedNow;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = () => alive.current && scope.current === captured && latest.current();

  return <ScreenShell title={title} subtitle="Offene Nachweise je Pflegefall und Pflegeplan">
    {access.loading ? <LoadingState presentation="inline" message="Pflegezugriff wird geprüft …" />
      : access.error ? <ErrorState presentation="inline" message={access.error} onRetry={access.refreshPermissions} />
      : !tenantId || !allowed ? <ErrorState presentation="inline" message="Für diese Nachweisübersicht fehlt die aktuelle Berechtigung." />
      : <MdEvidenceQueue key={captured.generation} tenantId={tenantId} access={access} isCurrent={isCurrent} />}
  </ScreenShell>;
}

function MdEvidenceQueue({ tenantId, access, isCurrent }: { tenantId: string; access: CareAccess; isCurrent: () => boolean }) {
  const router = useRouter();
  const { c, typography } = useCareAdaptiveTokens();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MdEvidenceFilter>('pending');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [limit, setLimit] = useState(batchSize);
  const query = useAsyncQuery(async () => {
    if (!isCurrent()) return { ok: false as const, error: loadScopeError };
    const result = await fetchMdReadiness(tenantId, access.roleKey, access.permissions);
    return isCurrent() ? result : { ok: false as const, error: loadScopeError };
  }, [tenantId, access.roleKey], { retryCount: 0 });
  const unavailable = query.previewData || query.tableMissing || query.cacheMeta?.fromCache;
  const data = !unavailable && !query.error && !query.refreshError && !query.loading && !query.refreshing ? query.data : null;
  const latest = useRef({ data, access, isCurrent });
  latest.current = { data, access, isCurrent };
  const grouped = useMemo(() => data ? groupMdEvidenceCases(data) : [], [data]);
  const shown = useMemo(() => filterMdEvidenceCases(grouped, search, filter), [grouped, search, filter]);
  const pending = grouped.filter(item => item.pendingPlans > 0).length;
  const refresh = () => { if (isCurrent()) void query.refresh(); };
  const canOpen = (target: MdEvidenceTarget) => isCurrent() && latest.current.isCurrent()
    && data !== null && latest.current.data === data && canShowDesktopCatalogRoute(target.base, latest.current.access);
  const open = (target: MdEvidenceTarget) => { if (canOpen(target)) router.push(target.path as never); };
  const action = (target: MdEvidenceTarget | null) => target && canOpen(target)
    ? <PremiumButton title={target.label} size="sm" variant="secondary" onPress={() => open(target)} /> : null;

  return <View style={styles.content}>
    <SectionPanel title="Nachweisübersicht" subtitle="Interner Arbeitsstand für Pflegepläne mit Status aktiv">
      <InfoBanner presentation="inline" title="Was die Übersicht zeigt" message="CareSuite prüft sieben gespeicherte Merkmale. Die Zeitfenster beziehen sich auf diesen internen Nachweischeck. Fälle ohne aktiven Pflegeplan sind hier nicht enthalten. Die Übersicht ersetzt keine Prüfung durch den Medizinischen Dienst." />
      <View style={styles.toolbar}>
        <View style={styles.summary}>
          {data ? <Text accessibilityLiveRegion="polite" style={[typography.body, { color: c.text }]}>Pflegefälle mit aktivem Plan: {grouped.length} · Mit offenen Prüfpunkten: {pending}</Text> : null}
        </View>
        <PremiumButton title="Nachweise aktualisieren" size="sm" variant="secondary" onPress={refresh} disabled={query.loading || query.refreshing} />
      </View>
      {data?.length ? <View style={styles.filters}>
        <PremiumInput label="Pflegefall oder Plan suchen" value={search} maxLength={120} autoCorrect={false}
          onChangeText={value => { setSearch(value); setLimit(batchSize); }} />
        <FilterChipGroup options={filters} value={filter} wrap onChange={next => { setFilter(next); setLimit(batchSize); }} />
      </View> : null}
    </SectionPanel>
    {query.loading || query.refreshing ? <LoadingState presentation="inline" message="Nachweise werden aus der Datenbank gelesen …" />
      : !data ? <ErrorState presentation="inline" message={query.refreshError
        ? 'Die Nachweise konnten nicht aktualisiert werden. Frühere Werte werden bis zum nächsten erfolgreichen Abruf ausgeblendet.'
        : query.error ?? 'Es sind keine bestätigten Nachweisdaten verfügbar.'} onRetry={refresh} />
      : !data.length ? <EmptyState title="Keine aktiven Pflegepläne gefunden" message="Die Nachweisübersicht umfasst nur Pflegefälle mit aktuell aktivem Plan." />
      : !shown.length ? <EmptyState title={search.trim() ? 'Keine passenden Pflegefälle' : filter === 'pending' ? 'Keine offenen Prüfpunkte in dieser Übersicht' : 'Keine Pflegefälle für diesen Filter'}
        message={search.trim() ? 'Versuchen Sie einen anderen Namen oder Plantitel.' : 'Unter „Alle Pflegefälle“ sehen Sie alle geladenen Pflegepläne.'}
        actionLabel="Alle Pflegefälle anzeigen" onAction={() => { setFilter('all'); setSearch(''); setLimit(batchSize); }} />
      : <View style={styles.content}>
        <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: c.muted }]}>Angezeigt: {Math.min(limit, shown.length)} von {shown.length} Pflegefällen</Text>
        {shown.slice(0, limit).map(item => {
          const expanded = expandedCase === item.clientId;
          const caseLabel = item.clientName || 'Pflegefall ohne hinterlegten Namen';
          return <View key={item.clientId} style={[styles.case, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${caseLabel}: ${expanded ? 'Pflegepläne einklappen' : 'Pflegepläne anzeigen'}`}
              accessibilityState={{ expanded }} onPress={() => { if (isCurrent()) { setExpandedCase(expanded ? null : item.clientId); setExpandedPlan(null); } }}
              style={({ pressed }) => [styles.caseHeading, pressed && styles.pressed]}>
              <View style={styles.summary}>
                <Text style={[typography.h3, { color: c.text }]}>{caseLabel}</Text>
                <Text style={[typography.caption, { color: c.muted }]}>{item.pendingPlans ? `Pläne mit offenen Punkten: ${item.pendingPlans} von ${item.totalPlans}` : 'In den geladenen Plänen ist kein Prüfpunkt offen'}</Text>
              </View>
              <Text style={[typography.body, { color: c.text }]}>{expanded ? 'Einklappen' : 'Ansehen'}</Text>
            </Pressable>
            {expanded ? <View style={[styles.caseBody, { borderColor: c.border }]}>
              <View style={styles.actionRow}>{action(mdEvidenceTarget(item.plans[0], 'case'))}</View>
              {item.plans.map(plan => <MdPlanPanel key={plan.carePlanId} plan={plan} expanded={expandedPlan === plan.carePlanId}
                onToggle={() => { if (isCurrent()) setExpandedPlan(expandedPlan === plan.carePlanId ? null : plan.carePlanId); }} action={action} />)}
            </View> : null}
          </View>;
        })}
        {shown.length > limit ? <PremiumButton title="Weitere Pflegefälle anzeigen" variant="secondary" onPress={() => setLimit(value => value + batchSize)} /> : null}
      </View>}
  </View>;
}

function MdPlanPanel({ plan, expanded, onToggle, action }: {
  plan: PflegeMdReadinessItem; expanded: boolean; onToggle(): void; action(target: MdEvidenceTarget | null): ReactNode;
}) {
  const { c, typography } = useCareAdaptiveTokens();
  const ordered = [...mdEvidenceChecks].sort((left, right) => Number(plan.checks[left.key]) - Number(plan.checks[right.key]));
  const missing = ordered.filter(check => !plan.checks[check.key]);
  const planLabel = plan.planTitle || 'Pflegeplan ohne Bezeichnung';
  return <View style={[styles.plan, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${planLabel}: ${expanded ? 'Prüfpunkte einklappen' : 'Prüfpunkte anzeigen'}`}
      accessibilityState={{ expanded }} onPress={onToggle} style={({ pressed }) => [styles.caseHeading, pressed && styles.pressed]}>
      <View style={styles.summary}>
        <Text style={[typography.h3, { color: c.text }]}>{planLabel}</Text>
        <Text style={[typography.caption, { color: c.muted }]}>{missing.length ? missing.map(item => item.title).join(' · ') : 'Kein offener Punkt in diesem Nachweischeck'}</Text>
      </View>
      <PremiumBadge size="compact" variant={missing.length ? 'warning' : 'muted'} label={missing.length ? `${missing.length} von ${ordered.length} offen` : `${ordered.length} Punkte geprüft`} />
    </Pressable>
    {expanded ? <View style={[styles.caseBody, { borderColor: c.border }]}>
      <View style={styles.actionRow}>{action(mdEvidenceTarget(plan, 'plan'))}</View>
      {ordered.map(check => {
        const found = plan.checks[check.key];
        return <View key={check.key} style={[styles.check, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={styles.checkHeading}>
            <Text style={[typography.h3, styles.checkTitle, { color: c.text }]}>{check.title}</Text>
            <PremiumBadge size="compact" variant={found ? 'muted' : 'warning'} label={found ? 'Kein offener Punkt' : 'Offen'} />
          </View>
          <Text style={[typography.body, { color: c.muted }]}>{found ? check.requirement : check.gap}</Text>
          {!found && check.key !== 'activeMeasures' ? <View style={styles.actionRow}>{action(mdEvidenceTarget(plan, check.key))}</View> : null}
        </View>;
      })}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, width: '100%', minWidth: 0 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  filters: { gap: spacing.sm },
  summary: { gap: spacing.xs, minWidth: 0, flexBasis: 200, flexGrow: 1, flexShrink: 1 },
  case: { borderRadius: radius.lg, borderWidth: 1, minWidth: 0 },
  caseHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  pressed: { opacity: 0.78 },
  caseBody: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  plan: { borderRadius: radius.md, borderWidth: 1, minWidth: 0 },
  check: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, minWidth: 0 },
  checkHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  checkTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
