import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients, fetchCareAssessments } from '@/lib/careAssessment';
import { fetchCareOperations } from '@/lib/pflege/ambulatoryOperationsService';
import { buildAmbulatoryCaseOverview, caseAdmissionLabel, filterAmbulatoryCases, overviewSourceLabels, readCaseOverviewSource, standardCareReadLimit, type AmbulatoryCaseRow, type CaseOverviewFilter, type CaseOverviewSection, type OverviewSources } from '@/lib/pflege/ambulatoryCaseOverview';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { fetchCareMedicalOrders } from '@/lib/pflege/careClinicalCoreService';
import { fetchPflegeServiceProofs, fetchPflegeBillingCases } from '@/lib/pflege/careBillingLiveService';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { radius, spacing, typography } from '@/theme';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import type { PermissionKey } from '@/types/permissions';
import { CarePermissionStatus } from './CarePermissionStatus.web';

const title = 'Versorgungsübersicht';
const filters = [
  { key: 'all', label: 'Alle Pflegefälle' },
  { key: 'attention', label: 'Handlungsbedarf' },
  { key: 'active', label: 'In Versorgung' },
  { key: 'paused', label: 'Pausiert' },
] as const;
const batchSize = 40;

const overviewRoute = '/pflege/versorgungsuebersicht';
type CarePermissions = ReturnType<typeof useCareRuntimePermissions>;
type CaseRoute = '/pflege/klienten' | '/pflege/aufnahme' | '/pflege/aufgaben' | '/pflege/dokumentation' | '/pflege/plans';

export function AmbulatoryCareOverviewScreen() {
  const permissions = useCareRuntimePermissions();
  const auth = useAuth();
  const { profile, user, session } = auth;
  const tenant = permissions.tenantId;
  const token = session?.accessToken;
  const expires = session?.expiresAt;
  const isAuthorized = () => !!tenant && !!profile?.id && !!user?.id && !!token && session?.user.id === user.id
    && auth.authReady && auth.isAuthenticated && !auth.isLoading && !auth.profileBootstrapError && !auth.portalSession
    && profile.tenantId === tenant && profile.roleKey === permissions.roleKey
    && (expires === null || (typeof expires === 'number' && expires > Date.now()))
    && canShowDesktopCatalogRoute(overviewRoute, permissions);
  const canRead = isAuthorized();
  const scopeId = JSON.stringify([tenant, user?.id, profile?.id, permissions.roleKey, expires, [...permissions.permissions].sort()]);
  const scope = useRef({ scopeId, token, canRead, revision: 0 });
  if (scope.current.scopeId !== scopeId || scope.current.token !== token || scope.current.canRead !== canRead) {
    scope.current = { scopeId, token, canRead, revision: scope.current.revision + 1 };
  }
  const generation = scope.current;
  const latestAuthorization = useRef(isAuthorized);
  latestAuthorization.current = isAuthorized;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const currentRead = () => mounted.current && scope.current === generation && latestAuthorization.current();
  if (!tenant || !canRead) {
    return <ScreenShell title={title}>
      <CarePermissionStatus state={permissions} deniedMessage="Für die Versorgungsübersicht fehlt die aktuelle Leseberechtigung." />
    </ScreenShell>;
  }
  return <CareCases key={generation.revision} tenant={tenant} permissions={permissions} currentRead={currentRead} />;
}

function CareCases({ tenant, permissions, currentRead }: { tenant: string; permissions: CarePermissions; currentRead(): boolean }) {
  const router = useRouter();
  const { c } = useCareLightPalette();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CaseOverviewFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(batchSize);
  const query = useAsyncQuery(async () => {
    const role = permissions.roleKey;
    const allowed = (grant: PermissionKey) => () => currentRead() && permissions.can(grant);
    const [clients, operations, plans, assessments, orders, proofs, billing] = await Promise.all([
      readCaseOverviewSource(currentRead, () => fetchEligibleCareClients(tenant, role)),
      readCaseOverviewSource(currentRead, () => fetchCareOperations(tenant, role)),
      readCaseOverviewSource(currentRead, () => fetchCarePlanList(tenant, role)),
      readCaseOverviewSource(currentRead, () => fetchCareAssessments(tenant, 'client', role), rows => rows.length >= standardCareReadLimit),
      readCaseOverviewSource(allowed('pflege.orders.view'), () => fetchCareMedicalOrders(tenant, role)),
      readCaseOverviewSource(allowed('pflege.proofs.view'), () => fetchPflegeServiceProofs(tenant, role), rows => rows.length >= standardCareReadLimit),
      readCaseOverviewSource(allowed('pflege.billing.view'), () => fetchPflegeBillingCases(tenant, role), rows => rows.length >= standardCareReadLimit),
    ]);
    if (!currentRead() || clients.state !== 'ready') {
      return { ok: false as const, error: 'Die Liste der aktiven Pflegefälle konnte nicht bestätigt werden.' };
    }
    const sources: OverviewSources = { operations, plans, assessments, orders, proofs, billing };
    return { ok: true as const, data: { clients: clients.data, sources } };
  }, [tenant, permissions.roleKey], { retryCount: 0 });
  const today = berlinCalendarDate();
  const cases = useMemo(() => query.data ? buildAmbulatoryCaseOverview(query.data.clients, query.data.sources, today) : [], [query.data, today]);
  const shown = useMemo(() => filterAmbulatoryCases(cases, search, filter), [cases, search, filter]);
  const loading = query.loading || query.refreshing;
  const canOpen = (route: CaseRoute) => currentRead() && canShowDesktopCatalogRoute(route, permissions);
  const open = (route: CaseRoute, target: string) => {
    if (canOpen(route)) router.push(target as never);
  };

  if (!query.data) {
    return <ScreenShell title={title} subtitle="Aktive Pflegefälle Ihres Unternehmens">
      {loading ? <LoadingState presentation="inline" message="Pflegefälle werden geladen…" /> : <ErrorState presentation="inline"
        message={query.error ?? 'Pflegefälle konnten nicht geladen werden.'} onRetry={query.refresh} />}
    </ScreenShell>;
  }

  const { sources, clients } = query.data;
  const unavailable = (Object.keys(sources) as (keyof OverviewSources)[]).filter(key => sources[key].state === 'unavailable');
  const attentionCount = cases.filter(item => item.attention).length;
  const limited = clients.length >= standardCareReadLimit;

  return <ScreenShell title={title} subtitle="Pflegefälle finden, offene Vorgänge erkennen und die passende Akte öffnen"
    rightSlot={<PremiumButton title="Aktualisieren" variant="secondary" size="sm" loading={query.refreshing} onPress={query.refresh} />}>
    <View style={styles.stack}>
      <SectionPanel title="Pflegefälle" subtitle={`${cases.length} geladen · ${attentionCount} mit erkanntem Handlungsbedarf`}>
        <View style={styles.filters}>
          <View style={styles.search}>
            <PremiumInput label="Nach Vor- oder Nachname suchen" value={search} onChangeText={value => {
              setSearch(value); setExpandedId(null); setLimit(batchSize);
            }} />
          </View>
          <View style={styles.quickFilters}>
            <FilterChipGroup<CaseOverviewFilter> options={[...filters]} value={filter} wrap
              onChange={value => { setFilter(value); setExpandedId(null); setLimit(batchSize); }} />
          </View>
        </View>
      </SectionPanel>
      {query.refreshError ? <InfoBanner variant="warning" presentation="inline" title="Aktualisierung fehlgeschlagen"
        message="Sie sehen den zuletzt geladenen Stand. Bitte aktualisieren Sie erneut." /> : null}
      {limited ? <InfoBanner variant="warning" presentation="inline" title="Pflegefallliste möglicherweise unvollständig"
        message="Die Datenabfrage hat die maximale Trefferzahl erreicht. Die Suche umfasst die geladenen Fälle." /> : null}
      {unavailable.length ? <InfoBanner variant="warning" presentation="inline" title="Statusangaben teilweise nicht verfügbar"
        message={`${unavailable.map(key => overviewSourceLabels[key]).join(', ')} konnten nicht vollständig geladen werden. Die betreffenden Angaben zählen nicht als erledigt.`} /> : null}
      <SectionPanel title={`Treffer (${shown.length})`} subtitle={shown.length > limit ? `${limit} angezeigt` : undefined}>
        {!shown.length ? <EmptyState title={cases.length ? 'Keine passenden Pflegefälle' : 'Keine aktiven Pflegefälle'}
          message={cases.length ? 'Ändern Sie den Suchbegriff oder wählen Sie „Alle Pflegefälle“.' : limited
            ? 'In den geladenen Daten wurden keine anzeigbaren Fälle gefunden.'
            : 'Die Übersicht zeigt aktive Klient:innen mit einer aktiven Zuordnung zum Modul Pflege.'}
          actionLabel={cases.length ? 'Suche und Filter zurücksetzen' : undefined}
          onAction={cases.length ? () => { setSearch(''); setFilter('all'); setLimit(batchSize); } : undefined} /> : null}
        {shown.slice(0, limit).map(item => {
          const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Pflegefall ohne Namen';
          const expanded = expandedId === item.id;
          return <View key={item.id} style={[styles.case, { borderColor: c.border }]}>
            <View style={styles.caseHeader}>
              <View style={styles.caseIdentity}>
                <Text style={[styles.name, { color: c.text }]}>{name}</Text>
                <Text style={[styles.body, { color: c.muted }]}>
                  {describe(item.admission, caseAdmissionLabel) ?? 'Aufnahmestatus nicht verfügbar'}
                  {item.attention ? ' · Handlungsbedarf' : ''}
                </Text>
              </View>
              <View style={styles.caseActions}>
                {canOpen('/pflege/klienten') ? <PremiumButton title="Pflegeakte öffnen"
                  accessibilityLabel={`Pflegeakte öffnen: ${name}`} size="sm"
                  onPress={() => open('/pflege/klienten', `/pflege/klienten/${encodeURIComponent(item.id)}`)} /> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded} accessibilityLabel={`Prozessstand: ${name}`}
                  onPress={() => { if (currentRead()) setExpandedId(expanded ? null : item.id); }}
                  style={({ pressed }) => [styles.disclosure, { borderColor: c.border, backgroundColor: c.surfaceAlt, opacity: pressed ? .75 : 1 }]}>
                  <Text style={[styles.disclosureText, { color: c.text }]}>{expanded ? 'Prozessstand ausblenden' : 'Prozessstand anzeigen'}</Text>
                </Pressable>
              </View>
            </View>
            {expanded ? <CaseSteps item={item} canOpen={canOpen} open={open} /> : null}
          </View>;
        })}
        {shown.length > limit ? <PremiumButton title="Weitere Pflegefälle anzeigen" variant="secondary" onPress={() => setLimit(value => value + batchSize)} /> : null}
      </SectionPanel>
    </View>
  </ScreenShell>;
}

function describe<T>(section: CaseOverviewSection<T>, map: (data: T) => string) {
  return section.state === 'ready' ? map(section.value) : section.state === 'unavailable' ? 'Nicht verfügbar' : null;
}
function count(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}
function CaseSteps({ item, canOpen, open }: { item: AmbulatoryCaseRow; canOpen: (route: CaseRoute) => boolean; open: (route: CaseRoute, target: string) => void }) {
  const { c } = useCareLightPalette();
  const caseId = encodeURIComponent(item.id);
  const planId = item.plan.state === 'ready' ? item.plan.value.onlyId : null;
  const documentation = canOpen('/pflege/dokumentation');
  const steps = [
    { label: 'Aufnahme & Vertrag', value: describe(item.admission, caseAdmissionLabel),
      action: canOpen('/pflege/aufnahme') ? 'Aufnahme öffnen' : undefined,
      run: () => open('/pflege/aufnahme', `/pflege/aufnahme?clientId=${caseId}`) },
    { label: 'Aufgaben & Wiedervorlagen', value: describe(item.openTasks, v => `${v.open} offen · ${v.overdue} überfällig`),
      action: canOpen('/pflege/aufgaben') ? 'Wiedervorlagen öffnen' : undefined,
      run: () => open('/pflege/aufgaben', `/pflege/aufgaben?clientId=${caseId}`) },
    { label: 'Pflegeplanung', value: describe(item.plan, v => count(v.active, 'aktiver Pflegeplan', 'aktive Pflegepläne')),
      action: canOpen('/pflege/plans') ? planId ? 'Pflegeplan öffnen' : 'Pflegepläne dieses Falls' : undefined,
      run: () => open('/pflege/plans', planId ? `/pflege/plans/${encodeURIComponent(planId)}` : `/pflege/plans?clientId=${caseId}`) },
    { label: 'SIS & Assessments', value: describe(item.assessment, v => count(v, 'Assessment', 'Assessments')) },
    { label: 'Pflegedokumentation', value: documentation ? 'Fallbezogenen Verlauf öffnen' : null,
      action: documentation ? 'Dokumentation öffnen' : undefined,
      run: () => open('/pflege/dokumentation', `/pflege/dokumentation?clientId=${caseId}`) },
    { label: 'Verordnungen', value: describe(item.order, v => `${v.running} laufend oder pausiert · ${v.approvals} Genehmigungen offen · ${v.expired} abgelaufen`) },
    { label: 'Leistungsnachweise', value: describe(item.proof, v => `${v} ohne vollständige Freigabe`) },
    { label: 'Abrechnung', value: describe(item.bill, v => `${v.blocked} blockiert · ${v.ready} freigabebereit`) },
  ];
  return <View style={styles.steps}>
    {steps.map(step => step.value !== null ? <View key={step.label} style={[styles.step, { borderColor: c.border }]}>
      <Text style={[styles.name, { color: c.text }]}>{step.label}</Text>
      <Text style={[styles.body, { color: c.muted }]}>{step.value}</Text>
      {step.action ? <PremiumButton title={step.action} size="sm" variant="secondary" onPress={step.run} /> : null}
    </View> : null)}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, paddingBottom: spacing.xl },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.md },
  search: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0 },
  quickFilters: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
  case: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  caseHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  caseIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, gap: spacing.xs },
  caseActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.bodyStrong },
  body: { ...typography.body },
  disclosure: { minHeight: 36, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, justifyContent: 'center', borderWidth: 1, borderRadius: radius.md },
  disclosureText: { ...typography.bodyStrong },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
  step: { flexGrow: 1, flexShrink: 1, flexBasis: 235, minWidth: 0, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs, alignItems: 'flex-start' },
});
