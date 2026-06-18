import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumButton, PremiumInput } from '@/components/ui';
import {
  useCareLightPalette,
  type CareLightResolved,
} from '@/design/tokens/carelightadaptive';
import { careTypography } from '@/design/tokens/typography';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type FilterOption = { key: string; label: string };

type EmployeesFilterToolbarProps = {
  compact?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusFilters: FilterOption[];
  sortKey: string;
  onSortChange: (value: string) => void;
  sortOptions: FilterOption[];
  hasActiveFilters: boolean;
  onResetFilters: () => void;
};

export function EmployeesFilterToolbar({
  compact = false,
  search,
  onSearchChange,
  filteredCount,
  totalCount,
  statusFilter,
  onStatusChange,
  statusFilters,
  sortKey,
  onSortChange,
  sortOptions,
  hasActiveFilters,
  onResetFilters,
}: EmployeesFilterToolbarProps) {
  const { typography } = useLegacyTheme();
  const { c } = useCareLightPalette();
  const styles = useMemo(() => makeStyles(c, typography), [c, typography]);
  const [expanded, setExpanded] = useState(false);
  const showFilters = !compact || expanded;

  const filterToggle = compact ? (
    <View style={styles.compactBar}>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        style={[styles.filterToggle, hasActiveFilters ? styles.filterToggleActive : null]}
        accessibilityRole="button"
        accessibilityState={{ expanded: showFilters }}
      >
        <Text style={styles.filterToggleText}>
          {showFilters ? 'Filter ausblenden' : 'Filter & Sortierung'}
          {hasActiveFilters ? ' ●' : ''}
        </Text>
      </Pressable>
      {hasActiveFilters ? (
        <PremiumButton title="Zurücksetzen" variant="ghost" size="sm" onPress={onResetFilters} />
      ) : null}
    </View>
  ) : null;

  const filterGroups = (
    <>
      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={onStatusChange} />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={onSortChange} />
    </>
  );

  return (
    <View style={styles.toolbar}>
      <PremiumInput
        label="Suche"
        placeholder="Name, Rolle oder E-Mail…"
        value={search}
        onChangeText={onSearchChange}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Mitarbeitende`}
      />

      {filterToggle}

      {showFilters ? (
        compact ? (
          <View style={styles.filterPanel}>{filterGroups}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inlineFilters}
          >
            <View style={styles.inlineGroup}>
              <Text style={styles.inlineLabel}>Status</Text>
              <FilterChipGroup
                options={statusFilters}
                value={statusFilter}
                onChange={onStatusChange}
              />
            </View>
            <View style={styles.inlineGroup}>
              <Text style={styles.inlineLabel}>Sortierung</Text>
              <FilterChipGroup options={sortOptions} value={sortKey} onChange={onSortChange} />
            </View>
          </ScrollView>
        )
      ) : null}

      {!compact && hasActiveFilters ? (
        <PremiumButton title="Filter zurücksetzen" variant="ghost" size="sm" onPress={onResetFilters} />
      ) : null}
    </View>
  );
}

function makeStyles(c: CareLightResolved, typography: ReturnType<typeof useLegacyTheme>['typography']) {
  return StyleSheet.create({
    toolbar: {
      gap: spacing.sm,
    },
    compactBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    filterToggle: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.surfaceAlt,
    },
    filterToggleActive: {
      borderColor: c.orange,
      backgroundColor: c.isDark ? 'rgba(255,149,0,0.14)' : 'rgba(255,122,26,0.10)',
    },
    filterToggleText: {
      ...careTypography.caption,
      color: c.text,
      fontWeight: '600',
    },
    filterPanel: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    filterLabel: {
      ...typography.label,
      color: c.text,
      marginTop: spacing.xs,
    },
    inlineFilters: {
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    inlineGroup: {
      gap: spacing.xs,
    },
    inlineLabel: {
      ...careTypography.caption,
      color: c.muted,
    },
  });
}
