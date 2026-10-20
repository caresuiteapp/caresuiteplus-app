import { StyleSheet, View } from 'react-native';
import { AssistServiceCatalogHero } from '@/components/admin/AssistServiceCatalogHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ModuleTile,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  ASSIST_SERVICE_AREA_LABELS,
  ASSIST_SERVICE_CATALOG_PREPARED_MESSAGE,
  fetchAssistServices,
  isAssistServiceCatalogLiveReady,
} from '@/lib/assistServiceCatalog';
import { spacing } from '@/theme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

export function AssistServiceCatalogScreen() {
  const tenantId = useServiceTenantId();
  const { colors } = useLegacyTheme();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return Promise.resolve(fetchAssistServices(tenantId));
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Leistungen & Aufgaben" subtitle="Wird geladen…" scroll>
        <LoadingState message="Leistungskatalog wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Leistungen & Aufgaben" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const services = query.data ?? [];

  return (
    <ScreenShell title="Leistungen & Aufgaben" subtitle="Mehr → Verwaltung → Leistungen & Aufgaben" scroll>
      <AssistServiceCatalogHero
        services={services}
        isLiveReady={isAssistServiceCatalogLiveReady()}
        preparedMessage={ASSIST_SERVICE_CATALOG_PREPARED_MESSAGE}
      />

      <SectionPanel title="Leistungsbereiche" subtitle="Zehn Assist-Bereiche — keine Pflegeleistungen als Alltagsbegleitung">
        <View style={styles.grid}>
          {Object.entries(ASSIST_SERVICE_AREA_LABELS).map(([key, label]) => {
            const count = services.filter((service) => service.category === key).length;
            return (
              <ModuleTile
                key={key}
                icon="🧭"
                title={label}
                description={`${count} Leistung${count === 1 ? '' : 'en'} konfiguriert`}
                isActive={count > 0}
                accentColor={colors.orange}
              />
            );
          })}
        </View>
      </SectionPanel>

      {services.length === 0 ? (
        <EmptyState
          title="Keine Leistungen"
          message="Legen Sie Leistungen im Assist-Katalog an — Aufgabenpakete und Stundensätze folgen je Leistung."
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
});
