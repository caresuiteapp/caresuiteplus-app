import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ModuleOverviewKpiCard } from '@/components/dashboard/ModuleOverviewKpiCard';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { DashboardModuleOverviewRow } from '@/types/dashboard';

type ModuleOverviewDashboardProps = {
  rows: DashboardModuleOverviewRow[];
};

/** Geschätzte Mindesthöhe: Spaltenkopf + 5 KPI-Karten inkl. Abstände. */
const KPI_CARD_MIN_HEIGHT = 150;
const KPI_ROWS = 5;
const COLUMN_HEADER_HEIGHT = 88;
export const MODULE_OVERVIEW_MIN_GRID_HEIGHT =
  COLUMN_HEADER_HEIGHT +
  KPI_ROWS * KPI_CARD_MIN_HEIGHT +
  careSpacing.sm * (KPI_ROWS - 1);

function createModuleOverviewStyles() {
  return StyleSheet.create({
    container: {
      width: '100%',
      minHeight: MODULE_OVERVIEW_MIN_GRID_HEIGHT,
    },
    gridRow: {
      flexDirection: 'row',
      width: '100%',
      minHeight: MODULE_OVERVIEW_MIN_GRID_HEIGHT,
      gap: careSpacing.sm,
      alignItems: 'flex-start',
      paddingHorizontal: careSpacing.xs,
    },
    column: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: careSpacing.xs,
      gap: careSpacing.sm,
    },
    header: {
      alignItems: 'center',
      gap: careSpacing.sm,
      paddingBottom: careSpacing.sm,
      flexShrink: 0,
    },
    accentBar: {
      width: '80%',
      height: 3,
      borderRadius: 2,
    },
    moduleLabel: {
      ...careTypography.label,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      textAlign: 'center',
    },
    kpiStack: {
      gap: careSpacing.sm,
      width: '100%',
      paddingBottom: careSpacing.xs,
    },
  });
}

function ModuleOverviewColumn({
  row,
  onNavigate,
  styles,
}: {
  row: DashboardModuleOverviewRow;
  onNavigate: (route: string) => void;
  styles: ReturnType<typeof createModuleOverviewStyles>;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <View style={[styles.accentBar, { backgroundColor: row.accentColor }]} />
        <Text style={[styles.moduleLabel, { color: row.accentColor }]}>{row.label}</Text>
      </View>
      <View style={styles.kpiStack}>
        {row.kpis.map((kpi) => (
          <ModuleOverviewKpiCard
            key={`${row.moduleKey}-${kpi.id}`}
            moduleKey={row.moduleKey}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            accentColor={row.accentColor}
            onPress={() => {
              if (kpi.route) onNavigate(kpi.route);
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** 6 module columns (left→right), 5 equal KPI cards stacked vertically per column. */
export function ModuleOverviewDashboard({ rows }: ModuleOverviewDashboardProps) {
  const router = useRouter();
  const styles = useMemo(() => createModuleOverviewStyles(), []);

  const onNavigate = (route: string) => {
    router.push(route as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridRow}>
        {rows.map((row) => (
          <ModuleOverviewColumn key={row.moduleKey} row={row} onNavigate={onNavigate} styles={styles} />
        ))}
      </View>
    </View>
  );
}
