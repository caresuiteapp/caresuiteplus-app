import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ExecutiveDashboardHero } from '@/components/reporting/ExecutiveDashboardHero';
import { ReportingKpiCard } from '@/components/reporting/ReportingKpiCard';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, InfoBanner, LoadingState } from '@/components/ui';
import { useReportingDashboard } from '@/hooks/useReportingDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { REPORTING_DATE_RANGE_PRESETS } from '@/lib/reporting';
import type { ReportingDateRangePreset } from '@/types/reporting/metrics';
import { colors, spacing, typography } from '@/theme';

const PRESET_LABELS: Record<ReportingDateRangePreset, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  current_week: 'Woche',
  last_week: 'Vorwoche',
  current_month: 'Monat',
  last_month: 'Vormonat',
  quarter: 'Quartal',
  year: 'Jahr',
  custom: 'Custom',
};

/** Prompt 70 — Geschäftsführer & rollenbasierte Reporting-Dashboards */
export function ExecutiveDashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [preset, setPreset] = useState<ReportingDateRangePreset>('current_month');
  const { data, loading, error, refresh } = useReportingDashboard({ dateRangePreset: preset });

  if (!can('business.reporting.view')) {
    return (
      <ScreenShell title="Reporting-Dashboard" subtitle={roleLabel ?? 'Reporting'} showBack={false}>
        <LockedActionBanner
          message={check('business.reporting.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && !data) {
    return (
      <ScreenShell title="Reporting-Dashboard" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Kennzahlen werden berechnet…" />
      </ScreenShell>
    );
  }

  if (error && !data) {
    return (
      <ScreenShell title="Reporting-Dashboard" subtitle="Fehler" showBack={false}>
        <ErrorState title="Reporting-Dashboard" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const snapshot = data!;

  return (
    <ScreenShell
      title="Reporting-Dashboard"
      subtitle={`${snapshot.kind.toUpperCase()} · ${roleLabel ?? 'Reporting'}`}
      showBack={false}
      rightSlot={
        <Pressable onPress={() => router.push('/business/reporting/list' as never)}>
          <Text style={styles.link}>Berichte</Text>
        </Pressable>
      }
    >
      <ExecutiveDashboardHero snapshot={snapshot} roleKey={roleKey} />

      {snapshot.preparedOnly ? (
        <InfoBanner
          title="Kennzahlen teilweise vorbereitet"
          message="Fehlende Tabellen werden als Vorbereitet markiert — keine geschätzten Werte."
        />
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {REPORTING_DATE_RANGE_PRESETS.filter((p) => p !== 'custom').map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, preset === p && styles.chipActive]}
            onPress={() => setPreset(p)}
          >
            <Text style={[styles.chipText, preset === p && styles.chipTextActive]}>{PRESET_LABELS[p]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Kennzahlen</Text>
      {snapshot.kpis.length === 0 ? (
        <EmptyState title="Keine KPIs" message="Für diese Rolle sind keine Kennzahlen freigegeben." />
      ) : (
        snapshot.kpis.map((metric) => <ReportingKpiCard key={metric.kpiId} metric={metric} />)
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.caption, color: colors.cyan },
  filterRow: { marginVertical: spacing.md, maxHeight: 44 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginRight: spacing.sm,
  },
  chipActive: { borderColor: colors.cyan, backgroundColor: 'rgba(98,243,255,0.12)' },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
});
