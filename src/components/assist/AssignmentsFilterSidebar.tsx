import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { FilterChipGroup } from '@/components/ui';
import {
  ASSIGNMENT_DATE_RANGE_FILTERS,
  type AssignmentDateRangeFilter,
} from '@/lib/assist/assignmentListFilters';
import type { WorkflowStatus } from '@/types';
import { useAuroraAdaptiveText, useAuroraGlassPanelStyle } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type AssignmentsFilterSidebarProps = {
  dateRange: AssignmentDateRangeFilter;
  onDateRangeChange: (value: AssignmentDateRangeFilter) => void;
  statusFilter: WorkflowStatus | 'all';
  onStatusFilterChange: (value: WorkflowStatus | 'all') => void;
  statusFilters: { key: WorkflowStatus | 'all'; label: string }[];
  employeeFilter: string;
  onEmployeeFilterChange: (value: string) => void;
  employeeOptions: { key: string; label: string }[];
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
  serviceOptions: { key: string; label: string }[];
};

/** Persistent desktop filter sidebar for Einsatzplanung. */
export function AssignmentsFilterSidebar({
  dateRange,
  onDateRangeChange,
  statusFilter,
  onStatusFilterChange,
  statusFilters,
  employeeFilter,
  onEmployeeFilterChange,
  employeeOptions,
  serviceFilter,
  onServiceFilterChange,
  serviceOptions,
}: AssignmentsFilterSidebarProps) {
  const text = useAuroraAdaptiveText();
  const panelStyle = useAuroraGlassPanelStyle();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sidebar: {
          width: 240,
          minWidth: 220,
          padding: spacing.md,
          gap: spacing.md,
          borderRadius: 12,
          alignSelf: 'flex-start',
        },
        section: { gap: spacing.xs },
        label: { ...typography.label, color: text.secondary },
      }),
    [text.secondary],
  );

  return (
    <View style={[styles.sidebar, panelStyle]}>
      <View style={styles.section}>
        <Text style={styles.label}>Zeitraum</Text>
        <FilterChipGroup
          options={ASSIGNMENT_DATE_RANGE_FILTERS}
          value={dateRange}
          onChange={onDateRangeChange}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Status</Text>
        <FilterChipGroup
          options={statusFilters}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Mitarbeiter:in</Text>
        <FilterChipGroup
          options={employeeOptions}
          value={employeeFilter}
          onChange={onEmployeeFilterChange}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Leistung</Text>
        <FilterChipGroup
          options={serviceOptions}
          value={serviceFilter}
          onChange={onServiceFilterChange}
        />
      </View>
    </View>
  );
}
