import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { FilterChipGroup, EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { usePermissions } from '@/hooks/usePermissions';
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
  const canView = can('office.employee_time.view');
  const canExport = can('office.employee_time.export');
  const [view, setView] = useState<WorkTimeListView>('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entriesResult = useMemo(() => {
    if (!canView) return null;
    return listEmployeeTimeEntries(DEMO_TENANT_ID, roleKey, { view });
  }, [canView, view, roleKey]);

  const exportHistory = useMemo(() => {
    if (!canExport || view !== 'export') return null;
    return fetchPayrollExportHistory(DEMO_TENANT_ID, roleKey);
  }, [canExport, view, roleKey]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setLoading(false);
  }, []);

  if (!canView) {
    return (
      <CareLightPageShell title="Arbeitszeiten" subtitle="Personal" scroll={false}>
        <EmptyState
          title="Kein Zugriff"
          message={check('office.employee_time.view').reason ?? 'Keine Berechtigung für Arbeitszeiten.'}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Arbeitszeiten" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Arbeitszeiten werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error) {
    return (
      <CareLightPageShell title="Arbeitszeiten" subtitle="Fehler" scroll={false}>
        <ErrorState message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const entries = entriesResult?.ok ? entriesResult.data : [];

  return (
    <CareLightPageShell
      title="Arbeitszeiten"
      subtitle={`Personal · ${roleLabel ?? 'Office'}`}
    >
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
    </CareLightPageShell>
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
