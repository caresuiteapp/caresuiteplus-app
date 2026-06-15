import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  CareLightEmptyState,
  CareLightErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchModuleAssignmentHub,
  type ModuleAssignmentHubSection,
} from '@/lib/officeModules/moduleAssignmentService';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';

function HubCard({
  section,
  onPress,
  accentColor,
}: {
  section: ModuleAssignmentHubSection;
  onPress: () => void;
  accentColor: string;
}) {
  return (
    <PremiumCard style={styles.card} accentColor={accentColor} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{section.icon}</Text>
        <PremiumBadge label={`${section.count}`} variant="muted" />
      </View>
      <Text style={styles.cardTitle}>{section.label}</Text>
      <Text style={styles.cardHint}>Office → Fachmodul</Text>
    </PremiumCard>
  );
}

export function OfficeModulesHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const officeAccent = moduleColor('office');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchModuleAssignmentHub(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const sections = query.data ?? [];

  if (query.loading && sections.length === 0) {
    return (
      <CareLightPageShell title="Modulzuordnungen" subtitle="Office">
        <LoadingState message="Modulbereiche werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && sections.length === 0) {
    return (
      <CareLightPageShell title="Modulzuordnungen" subtitle="Fehler">
        <CareLightErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Modulzuordnungen"
      subtitle={`Office Plattform · ${roleLabel ?? 'Demo'}`}
      scroll={false}
    >
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={query.refreshing}
            onRefresh={query.refresh}
            tintColor={officeAccent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.lead}>
              CareSuite+ Office ist die zentrale Plattform. Fachmodule zeigen zugeordnete Stammdaten — keine
              Duplikate der vollständigen Verwaltung.
            </Text>
            <PremiumButton
              title="Klient:innen in Office"
              variant="secondary"
              onPress={() => router.push('/business/office/clients' as never)}
            />
          </View>
        }
        renderItem={({ item }) => (
          <HubCard
            section={item}
            accentColor={officeAccent}
            onPress={() => router.push(item.route as never)}
          />
        )}
        ListEmptyComponent={
          <CareLightEmptyState title="Keine Bereiche" message="Modulzuordnungen konnten nicht geladen werden." />
        }
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  list: { padding: careSpacing.md, gap: careSpacing.sm },
  row: { gap: careSpacing.sm },
  header: { marginBottom: careSpacing.md, gap: careSpacing.sm },
  lead: { ...careTypography.body, color: careLightColors.muted },
  loading: { ...careTypography.body, color: careLightColors.muted, textAlign: 'center', paddingVertical: careSpacing.xl },
  card: { flex: 1, minWidth: '45%' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIcon: { fontSize: 24 },
  cardTitle: { ...careTypography.bodyStrong, color: careLightColors.navy, marginTop: careSpacing.xs },
  cardHint: { ...careTypography.caption, color: careLightColors.muted, marginTop: careSpacing.xs },
});
