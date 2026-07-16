import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformKpiGrid, PlatformShellLayout, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { fetchPlatformDashboardSummary, listPlatformAuditLog } from '@/lib/platformConsole';
import type { PlatformDashboardSummary } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformDashboardScreen() {
  const router = useRouter();
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
        <View style={styles.commandPanel}>
          <View style={styles.commandHeader}>
            <View>
              <Text style={styles.commandTitle}>Operator-Aufgaben</Text>
              <Text style={styles.commandSub}>Kritische Vorgänge, die jetzt Aufmerksamkeit benötigen.</Text>
            </View>
            <Pressable style={styles.refresh} onPress={() => void load()}><Text style={styles.refreshText}>Aktualisieren</Text></Pressable>
          </View>
          <View style={styles.taskGrid}>
            {[
              { label: 'Überfällige Rechnungen', count: summary.billing.pastDueInvoices, path: '/platform/billing', tone: '#B45309' },
              { label: 'Fehlgeschlagene Zahlungen', count: summary.billing.failedPayments, path: '/platform/payments', tone: '#B91C1C' },
              { label: 'Gesperrte Mandanten', count: summary.tenants.suspended, path: '/platform/tenants', tone: '#B91C1C' },
              { label: 'Ablaufende Modul-Tests', count: summary.modules.trialExpiring, path: '/platform/modules', tone: '#B45309' },
              { label: 'Aktive Support-Sessions', count: summary.system.activeSupportSessions, path: '/platform/support', tone: '#0369A1' },
            ].map((task) => (
              <Pressable key={task.label} style={styles.task} onPress={() => router.push(task.path as never)}>
                <Text style={[styles.taskCount, { color: task.tone }]}>{task.count}</Text>
                <Text style={styles.taskLabel}>{task.label}</Text>
                <Text style={styles.taskOpen}>Öffnen →</Text>
              </Pressable>
            ))}
          </View>
        </View>

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
  commandPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: PLATFORM_COLORS.border, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  commandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  commandTitle: { color: PLATFORM_COLORS.text, fontSize: 18, fontWeight: '800' },
  commandSub: { color: PLATFORM_COLORS.muted, fontSize: 12, marginTop: 3 },
  refresh: { borderWidth: 1, borderColor: PLATFORM_COLORS.borderStrong, borderRadius: 9, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  refreshText: { color: PLATFORM_COLORS.accent, fontWeight: '700', fontSize: 12 },
  taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  task: { minWidth: 160, flexGrow: 1, flexBasis: '18%', borderRadius: 12, borderWidth: 1, borderColor: PLATFORM_COLORS.border, backgroundColor: PLATFORM_COLORS.panelSoft, padding: spacing.md },
  taskCount: { fontSize: 24, fontWeight: '800' },
  taskLabel: { color: PLATFORM_COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 4 },
  taskOpen: { color: PLATFORM_COLORS.accent, fontSize: 11, marginTop: spacing.sm, fontWeight: '700' },
});
