import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { getConnectAdminRoadmapEntries } from '@/lib/connect/connectRoadmap';
import {
  CONNECT_COMPLIANCE_RISK_LABELS,
  CONNECT_RELEASE_STATUS_LABELS,
  CONNECT_ROADMAP_PHASE_LABELS,
  type ConnectComplianceRisk,
  type ConnectRoadmapEntry,
} from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

type ConnectRoadmapPanelProps = {
  maxEntries?: number;
};

function riskVariant(risk: ConnectComplianceRisk): 'green' | 'orange' | 'red' | 'muted' {
  if (risk === 'low') return 'green';
  if (risk === 'medium') return 'orange';
  if (risk === 'high' || risk === 'critical') return 'red';
  return 'muted';
}

export function ConnectRoadmapPanel({ maxEntries = 12 }: ConnectRoadmapPanelProps) {
  const entries = getConnectAdminRoadmapEntries().slice(0, maxEntries);

  return (
    <PremiumCard accentColor={colors.orange}>
      <Text style={styles.title}>Entwicklungs-Roadmap (Admin)</Text>
      <Text style={styles.disclaimer}>
        Priorisierung für CareSuite+ Connect — keine automatische Freischaltung. Status spiegelt
        Planung, nicht produktive Verfügbarkeit.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableHeader}>
        <HeaderCell label="Bereich" width={160} />
        <HeaderCell label="Phase" width={72} />
        <HeaderCell label="Status" width={120} />
        <HeaderCell label="Risiko" width={80} />
        <HeaderCell label="Nächster Schritt" width={240} />
      </ScrollView>

      <View style={styles.list}>
        {entries.map((entry) => (
          <RoadmapRow key={roadmapRowKey(entry)} entry={entry} />
        ))}
      </View>
    </PremiumCard>
  );
}

function RoadmapRow({ entry }: { entry: ConnectRoadmapEntry }) {
  return (
    <View style={styles.row}>
      <Cell width={160}>
        <Text style={styles.rowLabel} numberOfLines={2}>
          {entry.label}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {entry.categoryKey}
          {entry.integrationKey ? `.${entry.integrationKey}` : ''}
        </Text>
      </Cell>
      <Cell width={72}>
        <PremiumBadge label={`P${entry.phase}`} variant="cyan" />
      </Cell>
      <Cell width={120}>
        <Text style={styles.cellText}>{CONNECT_RELEASE_STATUS_LABELS[entry.release_status]}</Text>
      </Cell>
      <Cell width={80}>
        <PremiumBadge
          label={CONNECT_COMPLIANCE_RISK_LABELS[entry.compliance_risk]}
          variant={riskVariant(entry.compliance_risk)}
        />
      </Cell>
      <Cell width={240}>
        <Text style={styles.nextStep} numberOfLines={3}>
          {entry.next_step}
        </Text>
      </Cell>
    </View>
  );
}

function HeaderCell({ label, width }: { label: string; width: number }) {
  return (
    <Text style={[styles.headerCell, { width }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

function Cell({ width, children }: { width: number; children: ReactNode }) {
  return <View style={[styles.cell, { width }]}>{children}</View>;
}

function roadmapRowKey(entry: ConnectRoadmapEntry): string {
  return `${entry.scope}:${entry.categoryKey}:${entry.integrationKey ?? 'category'}`;
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    marginBottom: spacing.xs,
  },
  headerCell: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  cell: { justifyContent: 'center' },
  rowLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  cellText: { ...typography.caption, color: colors.textSecondary },
  nextStep: { ...typography.caption, color: colors.textSecondary },
});

export { CONNECT_ROADMAP_PHASE_LABELS };
