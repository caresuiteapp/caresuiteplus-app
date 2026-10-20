import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScreenShell } from '@/components/layout';
import { ModuleAssignmentListCard } from '@/components/office/ModuleAssignmentListCard';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { fetchModuleAssignmentList } from '@/lib/officeModules/moduleAssignmentService';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import type { ProductKey } from '@/types';
import { colors, spacing } from '@/theme';

const SECTION_LABELS: Record<ModuleAssignmentSection, string> = {
  clients: 'Klient:innen-Zuordnung',
  employees: 'Mitarbeitende-Zuordnung',
  services: 'Leistungskatalog',
  documents: 'Dokument-Sichtbarkeit',
  templates: 'Vorlagen-Zuordnung',
  permissions: 'Berechtigungsprofile',
  billing: 'Abrechnungsquellen',
};

const MODULE_FILTER_OPTIONS: { key: ProductKey | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  ...(['assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'office'] as ProductKey[]).map(
    (key) => ({
      key,
      label: PRODUCT_LABELS[key].replace('CareSuite+ ', ''),
    }),
  ),
];

type OfficeModuleAssignmentListScreenProps = {
  section: ModuleAssignmentSection;
};

export function OfficeModuleAssignmentListScreen({ section }: OfficeModuleAssignmentListScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ProductKey | 'all'>('all');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toolbar: {
          padding: spacing.md,
          gap: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: text.border,
        },
        list: { padding: spacing.md },
      }),
    [text.border],
  );

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchModuleAssignmentList(tenantId, section, profile?.roleKey, {
        search,
        moduleKey: moduleFilter === 'all' ? null : moduleFilter,
      });
    },
    [tenantId, profile?.roleKey, section, search, moduleFilter],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title={SECTION_LABELS[section]} subtitle="Wird geladen…">
        <LoadingState message="Einträge werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title={SECTION_LABELS[section]} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={SECTION_LABELS[section]}
      subtitle={`Office · ${roleLabel ?? 'Arbeitsbereich'}`}
      scroll={false}
    >
      <View style={styles.toolbar}>
        <PremiumInput
          label="Suche"
          value={search}
          onChangeText={setSearch}
          placeholder="Suchen…"
        />
        <FilterChipGroup
          options={MODULE_FILTER_OPTIONS}
          value={moduleFilter}
          onChange={(key) =>
            setModuleFilter((Array.isArray(key) ? key[0] : key) as ProductKey | 'all')
          }
          wrap
        />
        <PremiumButton
          title="← Modulübersicht"
          variant="ghost"
          onPress={() => router.push('/business/office/modules' as never)}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <ModuleAssignmentListCard
            title={item.title}
            subtitle={item.subtitle}
            meta={item.meta}
            moduleLabel={PRODUCT_LABELS[item.moduleKey].replace('CareSuite+ ', '')}
            status={item.status}
            onPress={item.officeLink ? () => router.push(item.officeLink as never) : undefined}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Keine Einträge"
            message="Für die gewählten Filter sind keine Zuordnungen vorhanden."
          />
        }
      />
    </ScreenShell>
  );
}
