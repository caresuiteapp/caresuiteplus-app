import { StyleSheet, Text, View } from 'react-native';
import { AuroraPageHeader } from '@/components/aurora';
import { DesktopListViewToggle, type DesktopListViewMode } from '@/components/ui';
import {
  ClientWorkspaceKpiCard,
  ClientWorkspaceLiveBadge,
  ClientWorkspaceButton,
  ClientWorkspacePanel,
} from './ClientWorkspacePrimitives';
import type { ClientListKpi } from '@/lib/office/clientListStats';
import { ROLE_LABELS } from '@/data/constants';
import { careSpacing } from '@/design/tokens/spacing';
import type { RoleKey } from '@/types';

type ClientsListHeroProps = {
  kpis: ClientListKpi[];
  roleKey: RoleKey;
  filteredCount: number;
  totalCount: number;
  canCreate: boolean;
  isReadOnly: boolean;
  onCreatePress?: () => void;
  onCsvPress?: () => void;
  onRefresh?: () => void;
  onKpiPress?: (kpiId: string) => void;
  activeKpiId?: string | null;
  canCsv?: boolean;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
  isLive?: boolean;
  isLiveConnected?: boolean;
};

export function ClientsListHero({
  kpis,
  roleKey,
  filteredCount,
  totalCount,
  canCreate,
  isReadOnly,
  onCreatePress,
  onCsvPress,
  onRefresh,
  onKpiPress,
  activeKpiId = null,
  canCsv = false,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
  isLive = false,
  isLiveConnected = false,
}: ClientsListHeroProps) {
  const resultText =
    filteredCount === totalCount
      ? `${totalCount} Datensätze im Überblick`
      : `${filteredCount} von ${totalCount} Datensätzen im aktuellen Fokus`;

  return (
    <View style={styles.root}>
      <AuroraPageHeader
        title="Klient:innen-Cockpit"
        subtitle="Versorgung, Aufnahme und Aktenführung"
        description={resultText}
        roleBadge={ROLE_LABELS[roleKey]}
        badges={isReadOnly ? [{ label: 'Lesemodus', variant: 'muted' }] : []}
        style={compact ? styles.compactFrame : undefined}
      >
        <ClientWorkspaceLiveBadge
          label={isLive ? (isLiveConnected ? 'Live synchronisiert' : 'Live-Verbindung wird aufgebaut') : 'Lokaler Datenmodus'}
          connected={!isLive || isLiveConnected}
          inverse
        />
      </AuroraPageHeader>

      <ClientWorkspacePanel
        eyebrow="Arbeitsüberblick"
        title="Versorgungsstatus"
        subtitle="Kennzahl auswählen, um die Ergebnisliste direkt zu fokussieren"
        compact={compact}
      >
        <View style={[styles.kpiRow, compact && styles.kpiRowCompact]}>
        {kpis.map((kpi) => (
          <ClientWorkspaceKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
             compact={compact}
             active={activeKpiId === kpi.id}
             onPress={onKpiPress ? () => onKpiPress(kpi.id) : undefined}
            style={compact ? styles.kpiItemCompact : styles.kpiItem}
          />
        ))}
        </View>

        <View style={styles.commandRow}>
          <View style={styles.actions}>
            {canCreate && onCreatePress ? <ClientWorkspaceButton label="+ Klient:in aufnehmen" variant="primary" onPress={onCreatePress} /> : null}
            {canCsv && onCsvPress ? <ClientWorkspaceButton label="Import / Export" onPress={onCsvPress} /> : null}
            {onRefresh ? <ClientWorkspaceButton label="Daten aktualisieren" variant="ghost" onPress={onRefresh} /> : null}
          </View>
          {showViewToggle && onViewModeChange ? (
            <View style={styles.viewToggle}>
              <Text style={styles.viewToggleLabel}>Darstellung</Text>
              <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
            </View>
          ) : null}
        </View>
      </ClientWorkspacePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
  compactFrame: { marginBottom: careSpacing.sm },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiRowCompact: { gap: careSpacing.xs },
  kpiItem: { flex: 1, minWidth: 160 },
  kpiItemCompact: { flexGrow: 1, flexShrink: 1, minWidth: 126, maxWidth: 220 },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: careSpacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    flex: 1,
  },
  viewToggle: { gap: 6, alignItems: 'flex-end' },
  viewToggleLabel: {
    color: '#34445A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
