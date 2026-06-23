import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchAuditDashboardSummary,
  fetchTimeTrackingCatalogs,
  fetchTimeTrackingSettings,
  listTimeAuditLogs,
  listTimeCorrectionRequests,
  exportTimeTrackingSummary,
  updateTimeTrackingSettings,
} from '@/lib/timeTracking';
import { typography } from '@/theme';

type AuditTab =
  | 'overview'
  | 'employees'
  | 'daily'
  | 'corrections'
  | 'warnings'
  | 'audit'
  | 'exports'
  | 'settings';

const TABS: Array<{ key: AuditTab; label: string }> = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'employees', label: 'Mitarbeitende' },
  { key: 'daily', label: 'Tagesprotokolle' },
  { key: 'corrections', label: 'Korrekturen' },
  { key: 'warnings', label: 'Hinweise' },
  { key: 'audit', label: 'Audit-Log' },
  { key: 'exports', label: 'Exporte' },
  { key: 'settings', label: 'Einstellungen' },
];

export function TimeTrackingAuditScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const [tab, setTab] = useState<AuditTab>('overview');
  const [message, setMessage] = useState<string | null>(null);

  const canAudit = can('time.audit.view') || can('time.tracking.admin.view');

  const summaryQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canAudit) return { ok: true as const, data: null };
      return fetchAuditDashboardSummary(tenantId, roleKey);
    }, [tenantId, roleKey, canAudit]),
    [tenantId, roleKey, canAudit],
  );

  const correctionsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canAudit) return { ok: true as const, data: [] as import('@/types/modules/timeTracking').TimeCorrectionRequest[] };
      return listTimeCorrectionRequests(tenantId, roleKey);
    }, [tenantId, roleKey, canAudit]),
    [tenantId, roleKey, canAudit],
  );

  const settingsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !can('time.settings.manage')) return { ok: true as const, data: null };
      return fetchTimeTrackingSettings(tenantId, roleKey);
    }, [tenantId, roleKey, can]),
    [tenantId, roleKey],
  );

  const handleExport = async () => {
    if (!tenantId) return;
    const result = await exportTimeTrackingSummary(tenantId, roleKey);
    if (result.ok) setMessage(`Export bereit (${result.data.workdayCount} Tage, ${result.data.auditCount} Audit-Einträge).`);
  };

  if (!canAudit) {
    return (
      <ScreenShell title="Arbeitszeit-Audit" subtitle="Sicherheit & Compliance">
        <LockedActionBanner
          message={check('time.audit.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (summaryQuery.loading && !summaryQuery.data) {
    return (
      <ScreenShell title="Arbeitszeit-Audit" subtitle="Wird geladen…">
        <LoadingState message="Audit-Dashboard wird geladen…" />
      </ScreenShell>
    );
  }

  const summary = summaryQuery.data;
  const auditLogs = tenantId ? listTimeAuditLogs(tenantId) : [];

  return (
    <ScreenShell title="Arbeitszeit-Audit" subtitle="Homeoffice — Metadaten & Nachvollziehbarkeit" scroll>
      <AuroraSegmentedControl options={TABS} value={tab} onChange={(key) => setTab(key as AuditTab)} />

      {tab === 'overview' ? (
        <SectionPanel title="Ampel-Übersicht">
          <View style={styles.kpiRow}>
            <PremiumKpiCard label="Arbeitstage" value={String(summary?.workdays.length ?? 0)} />
            <PremiumKpiCard label="Hinweise" value={String(summary?.warnings ?? 0)} />
            <PremiumKpiCard label="Aktivitätssignale" value={String(summary?.activityEvents ?? 0)} />
          </View>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            Ampel basiert auf Aktivitätssignalen, Inaktivitätsprüfungen und klaren Zeitblöcken — keine Surveillance.
          </Text>
        </SectionPanel>
      ) : null}

      {tab === 'employees' ? (
        <SectionPanel title="Mitarbeitende">
          {(summary?.workdays ?? []).map((w) => (
            <Text key={w.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {w.workDate} — {w.userId.slice(0, 8)}… — {w.status} — Ampel: {w.trafficLight ?? '—'}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {tab === 'daily' ? (
        <SectionPanel title="Tagesprotokolle">
          {(summary?.workdays ?? []).map((w) => (
            <Text key={`d-${w.id}`} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {w.workDate}: {w.startedAt?.slice(11, 16) ?? '—'} – {w.endedAt?.slice(11, 16) ?? 'offen'}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {tab === 'corrections' ? (
        <SectionPanel title="Korrekturanfragen">
          {(correctionsQuery.data ?? []).map((c) => (
            <Text key={c.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {c.status}: {c.reason.slice(0, 80)}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {tab === 'warnings' ? (
        <SectionPanel title="Hinweise">
          <Text style={{ color: text.secondary }}>{summary?.warnings ?? 0} Hinweise im Mandanten — neutrale Sprache.</Text>
        </SectionPanel>
      ) : null}

      {tab === 'audit' ? (
        <SectionPanel title="Audit-Log (append-only)">
          {auditLogs.slice(-20).reverse().map((log) => (
            <Text key={log.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {log.createdAt.slice(0, 19)} — {log.action}: {log.summary}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {tab === 'exports' ? (
        <SectionPanel title="Exporte">
          <PremiumButton title="CSV-Zusammenfassung exportieren" onPress={() => void handleExport()} />
        </SectionPanel>
      ) : null}

      {tab === 'settings' && can('time.settings.manage') ? (
        <SectionPanel title="Modul-Einstellungen">
          <Text style={{ color: text.primary }}>
            Inaktivität: {settingsQuery.data?.inactivityTriggerMinutes ?? 5} min / Antwort:{' '}
            {settingsQuery.data?.inactivityResponseMinutes ?? 2} min
          </Text>
          <PremiumButton
            title="Schwellwert auf 4 setzen"
            variant="secondary"
            onPress={() => {
              if (!tenantId) return;
              updateTimeTrackingSettings(tenantId, roleKey, { warningThresholdPerDay: 4 });
              void settingsQuery.refresh();
            }}
          />
        </SectionPanel>
      ) : null}

      {message ? <SuccessState title="Export" message={message} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
