import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AkademieDashboardView } from '@/components/dashboard/AkademieDashboardView';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { InfoBanner } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAkademieDashboard } from '@/hooks/useAkademieDashboard';
import { wp438A11y } from '@/lib/a11y/wp438-akademie';
import {
  AKADEMIE_EXTENSION_PREPARED_MESSAGE,
  isAkademieExtensionLiveReady,
} from '@/lib/akademie/akademieModuleConfig';
import { ModuleDocumentsSection } from '@/components/documents/ModuleDocumentsSection';
import {
  AKADEMIE_HEADER_PRIMARY_ACTIONS,
  AKADEMIE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/akademie/akademieDashboardWorkspace';
import {
  CATALOGS_MISSING_BANNER_MESSAGE,
  PREVIEW_DATA_BANNER_MESSAGE,
} from '@/lib/supabase/missingtablefallback';

export function AkademieIndexScreen() {
  const router = useRouter();
  const akademieAccent = moduleColor('akademie');
  const { stats, upcomingCourses, loading, error, refresh, isPreviewData, tableMissing } =
    useAkademieDashboard();

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...AKADEMIE_HEADER_PRIMARY_ACTIONS.map((action) => ({
      key: action.id,
      label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
      icon: action.icon,
      variant: 'primary' as const,
      onPress: () => navigate(action.route),
    })),
    ...AKADEMIE_HEADER_SECONDARY_ACTIONS.map((action) => ({
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
      moduleLabel="Akademie"
      title="Akademie"
      subtitle="Kurse, Pflichtschulungen und Zertifikate im Überblick"
      breadcrumbs={[
        { label: 'Start', href: '/business' },
        { label: 'Akademie' },
      ]}
    >
      {tableMissing ? (
        <InfoBanner title="Datenbank-Schema fehlt" message={CATALOGS_MISSING_BANNER_MESSAGE} />
      ) : isPreviewData ? (
        <InfoBanner title="Vorschaudaten" message={PREVIEW_DATA_BANNER_MESSAGE} />
      ) : !isAkademieExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={AKADEMIE_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <ActionToolbar actions={toolbarActions} accentColor={akademieAccent} />
      <AkademieDashboardView
        stats={stats}
        upcomingCourses={upcomingCourses}
        loading={loading}
        error={error}
        onRefresh={refresh}
      />
      <ModuleDocumentsSection
        targetModule="akademie"
        targetArea="course"
        title="Akademie-Vorlagen"
        subtitle="Teilnehmerliste, Zertifikat, Anwesenheitsliste, Prüfungsbogen u. a."
      />
      <View
        accessible
        accessibilityLabel={`${wp438A11y.screenLabel} · WP ${wp438A11y.wpNumber}`}
        accessibilityRole={wp438A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ModuleDashboardShell>
  );
}

const styles = StyleSheet.create({
  a11yAnchor: {
    height: 0,
    width: 0,
  },
});
