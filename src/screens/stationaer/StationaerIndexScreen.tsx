import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StationaerDashboardView } from '@/components/dashboard/StationaerDashboardView';
import { InactiveModuleBanner } from '@/components/stationaer';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { InfoBanner } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useStationaerDashboard } from '@/hooks/useStationaerDashboard';
import { wp398A11y } from '@/lib/a11y/wp398-stationaer';
import {
  STATIONAER_EXTENSION_PREPARED_MESSAGE,
  isStationaerExtensionLiveReady,
} from '@/lib/stationaer/stationaerModuleConfig';
import { ModuleDocumentsSection } from '@/components/documents/ModuleDocumentsSection';
import {
  STATIONAER_HEADER_PRIMARY_ACTIONS,
  STATIONAER_HEADER_SECONDARY_ACTIONS,
} from '@/lib/stationaer/stationaerDashboardWorkspace';
import { CARE_RECORDS_MISSING_BANNER_MESSAGE, PREVIEW_DATA_BANNER_MESSAGE } from '@/lib/supabase/missingtablefallback';

export function StationaerIndexScreen() {
  const router = useRouter();
  const stationaerAccent = moduleColor('stationaer');
  const { stats, activeResidents, loading, error, refresh, isPreviewData, tableMissing } =
    useStationaerDashboard();

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...STATIONAER_HEADER_PRIMARY_ACTIONS.map((action) => ({
      key: action.id,
      label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
      icon: action.icon,
      variant: 'primary' as const,
      onPress: () => navigate(action.route),
    })),
    ...STATIONAER_HEADER_SECONDARY_ACTIONS.map((action) => ({
      key: action.id,
      label: action.label,
      icon: action.icon,
      variant: 'secondary' as const,
      onPress: () => navigate(action.route),
    })),
    {
      key: 'refresh',
      label: 'Aktualisieren',
      icon: '🔄',
      variant: 'ghost' as const,
      onPress: refresh,
    },
  ];

  return (
    <ModuleDashboardShell
      moduleLabel="Stationär"
      title="Stationär"
      subtitle="Bewohner:innen, Belegung und Einrichtungsalltag im Überblick"
      breadcrumbs={[
        { label: 'Start', href: '/business' },
        { label: 'Stationär' },
      ]}
    >
      <InactiveModuleBanner productKey="stationaer" />
      {tableMissing ? (
        <InfoBanner title="Datenbank-Schema fehlt" message={CARE_RECORDS_MISSING_BANNER_MESSAGE} />
      ) : isPreviewData ? (
        <InfoBanner title="Vorschaudaten" message={PREVIEW_DATA_BANNER_MESSAGE} />
      ) : !isStationaerExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={STATIONAER_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <ActionToolbar actions={toolbarActions} accentColor={stationaerAccent} />
      <StationaerDashboardView
        stats={stats}
        activeResidents={activeResidents}
        loading={loading}
        error={error}
        onRefresh={refresh}
      />
      <ModuleDocumentsSection
        targetModule="stationaer"
        targetArea="resident"
        title="Stationäre Vorlagen"
        subtitle="Bewohnerstammblatt, SIS, Pflegebericht, Trinkprotokoll u. a."
      />
      <View
        accessible
        accessibilityLabel={`${wp398A11y.screenLabel} · WP ${wp398A11y.wpNumber}`}
        accessibilityRole={wp398A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ModuleDashboardShell>
  );
}

const styles = StyleSheet.create({
  a11yAnchor: { height: 0, width: 0 },
});
