import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  FilterChipGroup,
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  EMPLOYEE_TIME_ENTRY_TYPE_LABELS,
  WORK_TIME_STATUS_LABELS,
  type WorkTimeListView,
} from '@/types/modules/employeeTime';
import {
  fetchPayrollExportHistory,
  listEmployeeTimeEntries,
} from '@/lib/office/employeeTime';

const VIEWS: { key: WorkTimeListView; label: string }[] = [
  { key: 'daily', label: 'Täglich' },
  { key: 'weekly', label: 'Wöchentlich' },
  { key: 'monthly', label: 'Monatlich' },
  { key: 'open', label: 'Offen' },
  { key: 'erroneous', label: 'Fehlerhaft' },
  { key: 'corrections', label: 'Korrekturen' },
  { key: 'approval', label: 'Freigabe' },
  { key: 'export', label: 'Export' },
];

export function EmployeeWorkTimesScreen() {
  const { can, check, roleLabel, roleKey } = usePermissions();
  const tenantId = useServiceTenantId();
  const canView = can('office.employee_time.view');
  const canExport = can('office.employee_time.export');
  const [view, setView] = useState<WorkTimeListView>('daily');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const entriesResult = useMemo(() => {
    void revision;
    if (!canView || !tenantId) return null;
    return listEmployeeTimeEntries(tenantId, roleKey, { view });
  }, [canView, tenantId, view, roleKey, revision]);

  const exportHistory = useMemo(() => {
    void revision;
    if (!canExport || view !== 'export' || !tenantId) return null;
    return fetchPayrollExportHistory(tenantId, roleKey);
  }, [canExport, tenantId, view, roleKey, revision]);

  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((current) => current + 1);
    requestAnimationFrame(() => setLoading(false));
  }, []);

  if (!tenantId) {
    return (
      <ScreenShell title="Arbeitszeiten" subtitle="Personal" scroll={false}>
        <EmptyState title="Kein Mandant" message="Mandant konnte nicht aufgelöst werden." />
      </ScreenShell>
    );
  }

  if (!canView) {
    return (
      <ScreenShell title="Arbeitszeiten" subtitle="Personal" scroll={false}>
        <EmptyState
          title="Kein Zugriff"
          message={check('office.employee_time.view').reason ?? 'Keine Berechtigung für Arbeitszeiten.'}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Arbeitszeiten" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Arbeitszeiten werden geladen…" />
      </ScreenShell>
    );
  }

  const serviceError =
    entriesResult && !entriesResult.ok
      ? entriesResult.error
      : exportHistory && !exportHistory.ok
        ? exportHistory.error
        : null;

  if (serviceError) {
    return (
      <ScreenShell title="Arbeitszeiten" subtitle="Fehler" scroll={false}>
        <ErrorState message={serviceError} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const entries = entriesResult?.ok ? entriesResult.data : [];

  return (
    <ScreenShell
      title="Arbeitszeiten"
      subtitle={`Personal · ${roleLabel ?? 'Office'}`}
    >
      <PremiumButton title="Aktualisieren" variant="ghost" onPress={refresh} />
      <FilterChipGroup
        options={VIEWS.map((v) => ({ key: v.key, label: v.label }))}
        value={view}
        onChange={(key) => setView(key as WorkTimeListView)}
      />

      {view === 'export' && canExport && exportHistory?.ok ? (
        <PremiumCard style={styles.card}>
          <Text style={styles.sectionTitle}>Export-Historie</Text>
          {exportHistory.data.batches.length === 0 ? (
            <Text style={styles.meta}>Noch keine Lohnexporte vorbereitet.</Text>
          ) : (
            exportHistory.data.batches.map((batch) => (
              <View key={batch.id} style={styles.row}>
                <Text style={styles.entryTitle}>{batch.providerKey.toUpperCase()}</Text>
                <Text style={styles.meta}>
                  {batch.itemCount} Positionen · {batch.status}
                </Text>
              </View>
            ))
          )}
        </PremiumCard>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="Keine Einträge"
          message="Für diese Ansicht liegen noch keine berechneten Arbeitszeiten vor."
        />
      ) : (
        entries.map((entry) => (
          <PremiumCard key={entry.id} style={styles.card}>
            <Text style={styles.entryTitle}>
              {EMPLOYEE_TIME_ENTRY_TYPE_LABELS[entry.entryType]} · {entry.periodDate}
            </Text>
            <Text style={styles.meta}>
              {entry.netMinutes} Min. netto · {entry.travelMinutes} Min. Fahrzeit ·{' '}
              {entry.pauseMinutes} Min. Pause
            </Text>
            <PremiumBadge label={WORK_TIME_STATUS_LABELS[entry.status]} variant="muted" />
            {entry.plausibilityFlags.length > 0 ? (
              <Text style={styles.warning}>Flags: {entry.plausibilityFlags.join(', ')}</Text>
            ) : null}
          </PremiumCard>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  entryTitle: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, opacity: 0.75, marginTop: 4 },
  warning: { fontSize: 12, color: '#b45309', marginTop: 6 },
  row: { marginBottom: 8 },
});
