import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { fetchModuleAssignmentList } from '@/lib/officeModules/moduleAssignmentService';
import { PRODUCT_LABELS } from '@/data/demo/products';
import type { ProductKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

const SECTION_LABELS: Record<ModuleAssignmentSection, string> = {
  clients: 'Klient:innen-Zuordnung',
  employees: 'Mitarbeitende-Zuordnung',
  services: 'Leistungskatalog',
  documents: 'Dokument-Sichtbarkeit',
  templates: 'Vorlagen-Zuordnung',
  permissions: 'Berechtigungsprofile',
  billing: 'Abrechnungsquellen',
};

type OfficeModuleAssignmentListScreenProps = {
  section: ModuleAssignmentSection;
};

export function OfficeModuleAssignmentListScreen({ section }: OfficeModuleAssignmentListScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ProductKey | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchModuleAssignmentList(tenantId, section, profile?.roleKey, {
        search,
        moduleKey: moduleFilter,
      });
    },
    [tenantId, profile?.roleKey, section, search, moduleFilter],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const moduleKeys = useMemo(
    () => (['assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'office'] as ProductKey[]),
    [],
  );

  if (query.loading && items.length === 0) {
    return (
      <CareLightPageShell title={SECTION_LABELS[section]} subtitle="Wird geladen…">
        <LoadingState message="Einträge werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <CareLightPageShell title={SECTION_LABELS[section]} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={SECTION_LABELS[section]}
      subtitle={`Office · ${roleLabel ?? 'Demo'}`}
      scroll={false}
    >
      <View style={styles.toolbar}>
        <PremiumInput
          label="Suche"
          value={search}
          onChangeText={setSearch}
          placeholder="Suchen…"
        />
        <View style={styles.filters}>
          <Pressable
            style={[styles.chip, !moduleFilter && styles.chipActive]}
            onPress={() => setModuleFilter(null)}
          >
            <Text style={styles.chipText}>Alle</Text>
          </Pressable>
          {moduleKeys.map((key) => (
            <Pressable
              key={key}
              style={[styles.chip, moduleFilter === key && styles.chipActive]}
              onPress={() => setModuleFilter(moduleFilter === key ? null : key)}
            >
              <Text style={styles.chipText}>{PRODUCT_LABELS[key].replace('CareSuite+ ', '')}</Text>
            </Pressable>
          ))}
        </View>
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
          <Pressable
            style={styles.row}
            onPress={() => {
              if (item.officeLink) router.push(item.officeLink as never);
            }}
            accessibilityRole="button"
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>{item.subtitle}</Text>
              {item.meta ? <Text style={styles.rowMeta}>{item.meta}</Text> : null}
            </View>
            <View style={styles.rowBadges}>
              <PremiumBadge label={PRODUCT_LABELS[item.moduleKey].replace('CareSuite+ ', '')} variant="muted" />
              <PremiumBadge label={item.status} variant="muted" />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Keine Einträge"
            message="Für die gewählten Filter sind keine Zuordnungen vorhanden."
          />
        }
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { borderColor: colors.orange, backgroundColor: colors.bgPremium },
  chipText: { ...typography.caption, color: colors.textSecondary },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.sm,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  rowBadges: { gap: spacing.xs, alignItems: 'flex-end' },
});
