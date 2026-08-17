import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuroraSecondaryButton, AuroraSegmentedControl } from '@/components/aurora';
import { PremiumInput } from '@/components/ui';
import { ClientWorkspacePanel } from './ClientWorkspacePrimitives';
import type { ClientCareLevelFilterKey } from '@/lib/office/clientListStats';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

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

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <AuroraSegmentedControl options={options} value={value} onChange={onChange} />
    </View>
  );
}

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
  const [expanded, setExpanded] = useState(!compact);
  const showAdvanced = !compact || expanded;

  return (
    <ClientWorkspacePanel
      eyebrow="Intelligente Suche"
      title="Klient:innen finden und fokussieren"
      subtitle="Suche über Name, Ort und Postleitzahl · kombinierbare Live-Filter"
      compact={compact}
      accessory={
        <View style={styles.resultBadge}>
          <Text style={styles.resultValue}>{filteredCount}</Text>
          <Text style={styles.resultLabel}>von {totalCount}</Text>
        </View>
      }
    >
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <PremiumInput
            label="Schnellsuche"
            placeholder="Name, Ort oder Postleitzahl eingeben…"
            value={search}
            onChangeText={onSearchChange}
            autoCapitalize="words"
            autoCorrect={false}
            onDarkSurface
            hint={search ? `${filteredCount} Treffer für „${search}“` : 'Die Ergebnisliste reagiert unmittelbar auf Ihre Eingabe.'}
          />
        </View>
        {compact ? (
          <Pressable
            onPress={() => setExpanded((current) => !current)}
            style={[styles.expandButton, showAdvanced && styles.expandButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
          >
            <Text style={styles.expandButtonIcon}>{showAdvanced ? '−' : '+'}</Text>
            <Text style={styles.expandButtonText}>
              {showAdvanced ? 'Weniger Filter' : 'Filter & Sortierung'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FilterGroup
        label="Aktenstatus"
        options={lifecycleFilters}
        value={lifecycleFilter}
        onChange={onLifecycleChange}
      />

      {showAdvanced ? (
        <View style={styles.filterGrid}>
          <FilterGroup label="Bearbeitungsstand" options={statusFilters} value={statusFilter} onChange={onStatusChange} />
          <FilterGroup
            label="Pflegegrad"
            options={careLevelFilters}
            value={careLevelFilter}
            onChange={(value) => onCareLevelChange(value as ClientCareLevelFilterKey)}
          />
          {costBearerFilters.length > 1 ? (
            <FilterGroup label="Kostenträger" options={costBearerFilters} value={costBearerFilter} onChange={onCostBearerChange} />
          ) : null}
          <FilterGroup label="Sortierung" options={sortOptions} value={sortKey} onChange={onSortChange} />
        </View>
      ) : null}

      {hasActiveFilters ? (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterInfo}>
            <View style={styles.activeFilterDot} />
            <Text style={styles.activeFilterText}>Die Ergebnisliste ist gefiltert.</Text>
          </View>
          <AuroraSecondaryButton label="Alle Filter zurücksetzen" variant="ghost" onPress={onResetFilters} />
        </View>
      ) : null}
    </ClientWorkspacePanel>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: careSpacing.sm,
    flexWrap: 'wrap',
  },
  searchInput: { flex: 1, minWidth: 240 },
  resultBadge: {
    minWidth: 84,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderRadius: careRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  resultValue: {
    color: careSuiteAuroraTheme.accent.cyan,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '900',
  },
  resultLabel: {
    color: careSuiteAuroraTheme.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  expandButton: {
    minHeight: 48,
    paddingHorizontal: careSpacing.md,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: careSpacing.xs,
  },
  expandButtonActive: { borderColor: careSuiteAuroraTheme.accent.cyan },
  expandButtonIcon: {
    color: careSuiteAuroraTheme.accent.cyan,
    fontSize: 20,
    fontWeight: '900',
  },
  expandButtonText: {
    color: careSuiteAuroraTheme.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  filterGrid: { gap: careSpacing.md },
  group: { gap: 7 },
  groupLabel: {
    color: careSuiteAuroraTheme.text.secondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    paddingTop: careSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: careSuiteAuroraTheme.glass.border,
  },
  activeFilterInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeFilterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: careSuiteAuroraTheme.accent.cyan,
  },
  activeFilterText: {
    color: careSuiteAuroraTheme.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
