import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformKpiGrid, PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { fetchPlatformDashboardSummary, listPlatformAuditLog } from '@/lib/platformConsole';
import type { PlatformDashboardSummary } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformDashboardScreen() {
  const [summary, setSummary] = useState<PlatformDashboardSummary | null>(null);
  const [recentAudit, setRecentAudit] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [summaryResult, auditResult] = await Promise.all([
      fetchPlatformDashboardSummary(),
      listPlatformAuditLog({ limit: 5 }),
    ]);
    if (!summaryResult.ok) {
      setError(summaryResult.error);
      setLoading(false);
      return;
    }
    setSummary(summaryResult.data);
    if (auditResult.ok) {
      setRecentAudit(
        auditResult.data.items.map(
          (e) => `${new Date(e.created_at).toLocaleString('de-DE')} · ${e.action}`,
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PlatformShellLayout title="Dashboard"><LoadingState message="KPIs werden geladen…" /></PlatformShellLayout>;
  if (error || !summary) {
    return (
      <PlatformShellLayout title="Dashboard">
        <ErrorState title="Dashboard nicht verfügbar" message={error ?? 'Unbekannter Fehler'} onRetry={() => void load()} />
      </PlatformShellLayout>
    );
  }

  return (
    <PlatformShellLayout
      title="Platform Dashboard"
      subtitle="Mandanten, Billing, Module und Systemstatus auf einen Blick"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Mandanten</Text>
        <PlatformKpiGrid
          items={[
            { label: 'Aktive Mandanten', value: summary.tenants.active, tone: 'success' },
            { label: 'Trial aktiv', value: summary.tenants.trial },
            { label: 'Gesperrt', value: summary.tenants.suspended, tone: summary.tenants.suspended > 0 ? 'danger' : 'default' },
            { label: 'Onboarding', value: summary.tenants.onboarding },
            { label: 'Zahlung überfällig', value: summary.tenants.pastDue, tone: summary.tenants.pastDue > 0 ? 'warning' : 'default' },
            { label: 'Gekündigt', value: summary.tenants.cancelled },
          ]}
        />

        <Text style={styles.sectionTitle}>Billing</Text>
        <PlatformKpiGrid
          items={[
            { label: 'Offene Rechnungen', value: summary.billing.openInvoices },
            { label: 'Überfällige Rechnungen', value: summary.billing.pastDueInvoices, tone: 'warning' },
            { label: 'Fehlgeschlagene Zahlungen', value: summary.billing.failedPayments, tone: 'danger' },
            { label: 'Aktive Rabatte', value: summary.billing.activeDiscounts },
          ]}
        />

        <Text style={styles.sectionTitle}>Module & System</Text>
        <PlatformKpiGrid
          items={[
            { label: 'Beta-Module aktiv', value: summary.modules.betaActive },
            { label: 'Trial läuft ab (<7 Tage)', value: summary.modules.trialExpiring, tone: 'warning' },
            { label: 'Feature Flags aktiv', value: summary.system.activeFeatureFlags },
            { label: 'Support-Sessions', value: summary.system.activeSupportSessions },
            {
              label: 'Wartungsmodus',
              value: summary.system.maintenanceMode ? 'AKTIV' : 'Aus',
              tone: summary.system.maintenanceMode ? 'danger' : 'success',
            },
          ]}
        />

        {recentAudit.length > 0 ? (
          <View style={styles.auditBox}>
            <Text style={styles.sectionTitle}>Letzte Audit-Einträge</Text>
            {recentAudit.map((line) => (
              <Text key={line} style={styles.auditLine}>{line}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: { color: PLATFORM_COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: spacing.xs },
  auditBox: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: 6,
  },
  auditLine: { color: PLATFORM_COLORS.muted, fontSize: 12 },
});
