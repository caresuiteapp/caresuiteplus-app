import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareAdaptiveTokens } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchLivePflegeQualityStats } from '@/lib/pflege/careQualityLiveService';
import { pflegeQualityMetrics, pflegeQualityWorkflows } from '@/lib/pflege/pflegeQualityWorkspace';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { radius, spacing } from '@/theme';
import type { PflegeReportStats } from '@/types/modules/pflege';

const reportRoute = '/pflege/auswertungen';
const integerFormat = new Intl.NumberFormat('de-DE');
const scopeError = 'Die Berechtigungen für die Auswertungen haben sich geändert.';

export function PflegeReportsScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const access = useCareRuntimePermissions();
  const tenantId = access.tenantId;
  const allowed = Boolean(tenantId && profile?.id && profile.tenantId === tenantId && canShowDesktopCatalogRoute(reportRoute, access));
  const token = session?.accessToken;
  const scope = useRef({ key: 0, token, tenantId, profileId: profile?.id, permissions: access.permissions, allowed });
  const last = scope.current;
  if (last.token !== token || last.tenantId !== tenantId || last.profileId !== profile?.id
    || last.permissions !== access.permissions || last.allowed !== allowed) {
    scope.current = { key: last.key + 1, token, tenantId, profileId: profile?.id, permissions: access.permissions, allowed };
  }
  const key = scope.current.key;
  const currentAccess = useRef(access);
  currentAccess.current = access;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => mounted.current && scope.current.key === key && canShowDesktopCatalogRoute(reportRoute, currentAccess.current);
  const query = useAsyncQuery(async () => {
    if (!tenantId || !isCurrent()) return { ok: false as const, error: scopeError };
    const active = currentAccess.current;
    const result = await fetchLivePflegeQualityStats(tenantId, active.roleKey, { effectivePermissions: active.permissions });
    return isCurrent() ? result : { ok: false as const, error: scopeError };
  }, [key], { enabled: allowed, queryKey: `pflege-quality:${key}` });

  const canOpen = (route: string) => allowed && isCurrent() && canShowDesktopCatalogRoute(route, currentAccess.current);
  const onOpen = (route: string) => { if (canOpen(route)) router.push(route as never); };

  return (
    <ScreenShell title="Pflege-Auswertungen" subtitle="Qualität im Pflegealltag nachvollziehen">
      {access.loading ? <LoadingState presentation="inline" message="Berechtigungen werden geprüft …" />
        : access.error ? <ErrorState presentation="inline" message={access.error} onRetry={access.refreshPermissions} />
        : !allowed ? <ErrorState presentation="inline" message="Für dieses Konto sind keine Pflege-Auswertungen freigegeben." />
        : <PflegeReportsContent
            stats={!query.previewData && !query.tableMissing ? query.data : null}
            canOpen={canOpen}
            onOpen={onOpen}
            loading={query.loading}
            refreshing={query.refreshing}
            error={query.previewData || query.tableMissing ? 'Keine bestätigten Kennzahlen aus der Pflegedatenbank verfügbar.' : query.error}
            refreshError={query.refreshError}
            onRefresh={() => { if (isCurrent()) void query.refresh(); }}
          />}
    </ScreenShell>
  );
}

type ReportContentProps = {
  stats: PflegeReportStats | null;
  canOpen: (route: string) => boolean;
  onOpen: (route: string) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshError: string | null;
  onRefresh: () => void;
};

/** Render below ScreenShell to use the current panel contrast on web and native. */
export function PflegeReportsContent({ stats, canOpen, onOpen, loading, refreshing, error, refreshError, onRefresh }: ReportContentProps) {
  const { c, typography } = useCareAdaptiveTokens();
  const workflows = pflegeQualityWorkflows.filter((entry) => canOpen(entry.route));

  return (
    <View style={styles.content}>
      <SectionPanel title="Qualität auf einen Blick" subtitle="Kennzahlen für den aktiven Mandanten. Die Beschreibung unter jeder Zahl erklärt, was gezählt wird.">
        <View style={styles.summary}>
          <View style={styles.summaryCopy}>
            <Text accessibilityLiveRegion="polite" style={[typography.body, { color: c.text }]}>
              {refreshing ? 'Kennzahlen werden aktualisiert …' : refreshError ? 'Zuletzt erfolgreich geladene Kennzahlen' : stats ? 'Kennzahlen geladen' : 'Kennzahlen aus der Pflegedokumentation'}
            </Text>
            <Text style={[typography.caption, { color: c.muted }]}>Die Kennzahlen allein belegen keine MD-Prüfbereitschaft.</Text>
          </View>
          <PremiumButton title="Aktualisieren" variant="secondary" onPress={onRefresh} disabled={loading || refreshing} />
        </View>
        {!stats && loading ? <LoadingState presentation="inline" message="Kennzahlen werden geladen …" /> : null}
        {error || refreshError ? <ErrorState presentation="inline" message={refreshError ? 'Die Aktualisierung ist fehlgeschlagen. Die angezeigten Werte sind vom letzten erfolgreichen Abruf.' : error ?? 'Die Kennzahlen konnten nicht geladen werden.'} /> : null}
        {stats ? (
          <View style={styles.grid}>
            {pflegeQualityMetrics.map((metric) => (
              <View key={metric.key} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.cardText}>
                  <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{metric.title}</Text>
                  <Text style={[typography.h1, { color: c.text }]}>{integerFormat.format(stats[metric.key])}</Text>
                  <Text style={[typography.body, { color: c.muted }]}>{metric.description}</Text>
                </View>
                {canOpen(metric.route) ? <PremiumButton title={metric.action} variant="secondary" size="sm" onPress={() => onOpen(metric.route)} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </SectionPanel>
      {workflows.length ? (
        <SectionPanel title="Qualität im Alltag bearbeiten" subtitle="Direkt zu den Arbeitslisten, auf die Sie Zugriff haben.">
          <View style={styles.grid}>
            {workflows.map((entry) => (
              <View key={entry.route} style={[styles.card, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
                <View style={styles.cardText}>
                  <Text accessibilityRole="header" style={[typography.h3, { color: c.text }]}>{entry.title}</Text>
                  <Text style={[typography.body, { color: c.muted }]}>{entry.description}</Text>
                </View>
                <PremiumButton title={entry.action} size="sm" variant="secondary" onPress={() => onOpen(entry.route)} />
              </View>
            ))}
          </View>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, width: '100%', minWidth: 0, paddingBottom: spacing.lg },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  summaryCopy: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.md, minWidth: 0 },
  card: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: spacing.md, alignItems: 'stretch', justifyContent: 'space-between' },
  cardText: { gap: spacing.xs, minWidth: 0 },
});
