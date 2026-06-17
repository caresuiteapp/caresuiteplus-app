import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup, PremiumButton, PremiumInput } from '@/components/ui';
import type { ClientCareLevelFilterKey } from '@/data/demo/clientListStats';
import { colors, spacing, typography } from '@/theme';

type FilterOption = { key: string; label: string };

type ClientsFilterToolbarProps = {
  compact?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  lifecycleFilter: string;
  onLifecycleChange: (value: string) => void;
  lifecycleFilters: FilterOption[];
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusFilters: FilterOption[];
  careLevelFilter: string;
  onCareLevelChange: (value: ClientCareLevelFilterKey) => void;
  careLevelFilters: FilterOption[];
  costBearerFilter: string;
  onCostBearerChange: (value: string) => void;
  costBearerFilters: FilterOption[];
  sortKey: string;
  onSortChange: (value: string) => void;
  sortOptions: FilterOption[];
  hasActiveFilters: boolean;
  onResetFilters: () => void;
};

export function ClientsFilterToolbar({
  compact = false,
  search,
  onSearchChange,
  filteredCount,
  totalCount,
  lifecycleFilter,
  onLifecycleChange,
  lifecycleFilters,
  statusFilter,
  onStatusChange,
  statusFilters,
  careLevelFilter,
  onCareLevelChange,
  careLevelFilters,
  costBearerFilter,
  onCostBearerChange,
  costBearerFilters,
  sortKey,
  onSortChange,
  sortOptions,
  hasActiveFilters,
  onResetFilters,
}: ClientsFilterToolbarProps) {
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
      <Text style={styles.filterLabel}>Lebenszyklus</Text>
      <FilterChipGroup
        options={lifecycleFilters}
        value={lifecycleFilter}
        onChange={onLifecycleChange}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={onStatusChange} />

      <Text style={styles.filterLabel}>Pflegegrad</Text>
      <FilterChipGroup
        options={careLevelFilters}
        value={careLevelFilter}
        onChange={(value) => onCareLevelChange(value as ClientCareLevelFilterKey)}
      />

      {costBearerFilters.length > 1 ? (
        <>
          <Text style={styles.filterLabel}>Kostenträger</Text>
          <FilterChipGroup
            options={costBearerFilters}
            value={costBearerFilter}
            onChange={onCostBearerChange}
          />
        </>
      ) : null}

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={onSortChange} />
    </>
  );

  return (
    <View style={styles.toolbar}>
      <PremiumInput
        label="Suche"
        placeholder="Name oder Ort suchen…"
        value={search}
        onChangeText={onSearchChange}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Klient:innen`}
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
              <Text style={styles.inlineLabel}>Lebenszyklus</Text>
              <FilterChipGroup
                options={lifecycleFilters}
                value={lifecycleFilter}
                onChange={onLifecycleChange}
              />
            </View>
            <View style={styles.inlineGroup}>
              <Text style={styles.inlineLabel}>Status</Text>
              <FilterChipGroup
                options={statusFilters}
                value={statusFilter}
                onChange={onStatusChange}
              />
            </View>
            <View style={styles.inlineGroup}>
              <Text style={styles.inlineLabel}>Pflegegrad</Text>
              <FilterChipGroup
                options={careLevelFilters}
                value={careLevelFilter}
                onChange={(value) => onCareLevelChange(value as ClientCareLevelFilterKey)}
              />
            </View>
            {costBearerFilters.length > 1 ? (
              <View style={styles.inlineGroup}>
                <Text style={styles.inlineLabel}>Kostenträger</Text>
                <FilterChipGroup
                  options={costBearerFilters}
                  value={costBearerFilter}
                  onChange={onCostBearerChange}
                />
              </View>
            ) : null}
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

const styles = StyleSheet.create({
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
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
  },
  filterToggleActive: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  filterToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterPanel: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  filterLabel: {
    ...typography.label,
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
    ...typography.caption,
    color: colors.textMuted,
  },
});
