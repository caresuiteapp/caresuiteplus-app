import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import { CareLightModuleTile, EmptyState, ErrorState, InfoBanner, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useInventoryDashboard } from '@/hooks/inventory';
import { usePermissions } from '@/hooks/usePermissions';
import { INVENTORY_PREPARED_MESSAGE, isInventoryLiveReady } from '@/lib/inventory';

const NAV_AREAS = [
  { id: 'items', icon: '📦', title: 'Inventarposten', route: '/business/office/inventory/items' },
  { id: 'assignments', icon: '📤', title: 'Ausgaben', route: '/business/office/inventory/assignments' },
  { id: 'returns', icon: '📥', title: 'Rückgaben', route: '/business/office/inventory/returns' },
  { id: 'categories', icon: '🏷️', title: 'Kategorien', route: '/business/office/inventory/categories' },
  { id: 'locations', icon: '📍', title: 'Lagerorte', route: '/business/office/inventory/locations' },
  { id: 'damage', icon: '⚠️', title: 'Schaden/Verlust', route: '/business/office/inventory/damage' },
  { id: 'protocols', icon: '📄', title: 'Rückgabeprotokolle', route: '/business/office/inventory/protocols' },
  { id: 'audit', icon: '🔍', title: 'Audit', route: '/business/office/inventory/audit' },
  { id: 'employees', icon: '👤', title: 'Mitarbeiter-Ausstattung', route: '/business/office/inventory/employees' },
  { id: 'mdm', icon: '📱', title: 'Geräteverwaltung', route: '/business/office/inventory/mdm', liveReady: false },
  { id: 'offboarding', icon: '🚪', title: 'Offboarding', route: '/business/office/inventory/offboarding' },
  { id: 'barcode', icon: '▦', title: 'Barcode/QR', route: '/business/office/inventory/barcode', liveReady: false },
  { id: 'settings', icon: '⚙️', title: 'Einstellungen', route: '/business/office/inventory/settings', liveReady: false },
];

function buildKpis(data: NonNullable<ReturnType<typeof useInventoryDashboard>['data']>) {
  return [
    { id: 'total', label: 'Posten gesamt', value: String(data.totalItems) },
    { id: 'available', label: 'Verfügbar', value: String(data.availableItems) },
    { id: 'assigned', label: 'Ausgegeben', value: String(data.assignedItems) },
    { id: 'overdue', label: 'Überfällig', value: String(data.overdueReturns) },
    { id: 'damage', label: 'Offene Schäden', value: String(data.damageReportsOpen) },
  ];
}

/** Inventar & Rückgabe — Office Personal */
export function InventoryDashboardScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useInventoryDashboard();
  const accent = moduleColor('office');

  if (!can('inventory.view')) {
    return (
      <CareLightScreen>
        <LockedActionBanner message={check('inventory.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightScreen>
    );
  }

  if (loading && !data) {
    return (
      <CareLightScreen>
        <LoadingState message="Inventar wird geladen…" />
      </CareLightScreen>
    );
  }

  if (error && !data) {
    return (
      <CareLightScreen>
        <ErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  const kpis = data ? buildKpis(data) : [];

  return (
    <CareLightScreen>
      {!isInventoryLiveReady() ? (
        <InfoBanner title="Teilbereiche in Vorbereitung" message={INVENTORY_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="office"
        subtitle="Personal · Inventar & Rückgabe"
        kpis={kpis}
        kpiTitle="Kennzahlen"
        recentTitle="Offene Rückgaben"
        recentSubtitle={
          data!.openReturnRequests > 0
            ? `${data!.openReturnRequests} angefordert · ${data!.overdueReturns} überfällig`
            : 'Keine offenen Anforderungen'
        }
        recentSection={
          data!.openReturnRequests + data!.overdueReturns > 0 ? (
            <Text style={styles.hint}>Rückgaben unter „Ausgaben" oder „Offboarding" bearbeiten.</Text>
          ) : (
            <EmptyState
              title="Alles zurückgegeben"
              message={
                isInventoryLiveReady() && data!.totalItems === 0
                  ? 'Noch keine Inventarposten. Legen Sie unter „Inventarposten" den ersten Posten an — Kategorien werden automatisch angelegt.'
                  : 'Keine offenen Rückgabefälle.'
              }
            />
          )
        }
        quickActions={
          <View style={styles.grid}>
            {NAV_AREAS.map((area) => (
              <CareLightModuleTile
                key={area.id}
                icon={area.icon}
                title={area.title}
                description={area.liveReady === false ? 'Noch nicht freigeschaltet' : undefined}
                accentColor={accent}
                isActive={area.liveReady !== false}
                preparedOnly={area.liveReady === false}
                onPress={area.liveReady === false ? undefined : () => router.push(area.route as never)}
              />
            ))}
          </View>
        }
      />
    </CareLightScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  hint: {
    ...careTypography.caption,
    color: careLightColors.muted,
    paddingVertical: careSpacing.sm,
  },
});
