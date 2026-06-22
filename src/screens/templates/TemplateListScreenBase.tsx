import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { PreparedTemplateBanner, TemplateCard, TemplateListHero } from '@/components/templates';
import type { TemplateListHeroVariant, TemplateListModuleHeroKey } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
} from '@/components/ui';
import { useTemplates } from '@/hooks/templates';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import type { TemplateListFilters, TemplateModuleKey, TemplateType } from '@/types/templates';
import { colors, spacing, typography } from '@/theme';

const MODULE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'office', label: 'Office' },
  { key: 'assist', label: 'Assist' },
  { key: 'pflege', label: 'Pflege' },
  { key: 'stationaer', label: 'Stationär' },
  { key: 'beratung', label: 'Beratung' },
  { key: 'akademie', label: 'Akademie' },
  { key: 'communication', label: 'Kommunikation' },
];

type Props = {
  title: string;
  subtitle: string;
  baseFilters?: TemplateListFilters;
  listHeroModule?: TemplateListModuleHeroKey;
  showCreate?: boolean;
  createRoute?: string;
};

export function TemplateListScreenBase({
  title,
  subtitle,
  baseFilters = {},
  listHeroModule,
  showCreate = true,
  createRoute = '/business/templates/create',
}: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const heroVariant: TemplateListHeroVariant | null =
    baseFilters.scope === 'system' || baseFilters.scope === 'tenant'
      ? baseFilters.scope
      : listHeroModule ?? null;

  const filters = useMemo<TemplateListFilters>(
    () => ({
      ...baseFilters,
      search: search.trim() || undefined,
      moduleKey:
        moduleFilter === 'all' ? baseFilters.moduleKey : (moduleFilter as TemplateModuleKey),
    }),
    [baseFilters, search, moduleFilter],
  );

  const { templates, loading, error, refresh, isEmpty, serviceMode } = useTemplates(filters);

  if (!can('office.catalogs.view')) {
    return (
      <ScreenShell title={title} subtitle={roleLabel ?? 'Vorlagen'}>
        <LockedActionBanner
          message={check('office.catalogs.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && templates.length === 0) {
    return (
      <ScreenShell title={title} subtitle="Wird geladen…">
        <LoadingState message="Vorlagen werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && templates.length === 0) {
    return (
      <ScreenShell title={title} subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={title} subtitle={subtitle} scroll={false}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {heroVariant ? (
              <TemplateListHero
                variant={heroVariant}
                templates={templates}
                roleKey={roleKey}
                serviceMode={serviceMode}
                hasActiveSearch={Boolean(search.trim())}
              />
            ) : null}
            <PreparedTemplateBanner />
            <PremiumInput
              label="Suche"
              value={search}
              onChangeText={setSearch}
              placeholder="Titel, Inhalt, Tags…"
            />
            {!baseFilters.moduleKey ? (
              <FilterChipGroup
                options={MODULE_FILTERS}
                value={moduleFilter}
                onChange={setModuleFilter}
              />
            ) : null}
            <Text style={styles.count}>
              {templates.length} Vorlagen · {serviceMode === 'demo' ? 'Demo' : 'Live'}
            </Text>
            {showCreate && can('office.catalogs.edit') ? (
              <PremiumButton
                title="Neue Vorlage"
                onPress={() => router.push(createRoute as never)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="Keine Vorlagen" message="Passen Sie die Filter an oder legen Sie eine neue Vorlage an." />
        }
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            onPress={() => router.push(`/business/templates/${item.id}` as never)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  count: { ...typography.caption, color: colors.textMuted },
  list: { paddingBottom: spacing.xxl },
});

export type { TemplateType };
