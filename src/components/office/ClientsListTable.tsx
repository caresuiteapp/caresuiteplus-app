import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AuroraBadge } from '@/components/aurora';
import { ClientWorkspaceButton, ClientWorkspacePanel } from './ClientWorkspacePrimitives';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import type { ClientListItem } from '@/types/modules/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass, SYSTEM_LIQUID_COLORS } from '@/design/tokens/systemLiquidGlass';

type ClientsListTableProps = {
  clients: ClientListItem[];
  selectedId?: string | null;
  onClientPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: ClientListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'pink' as const;
    default:
      return 'muted' as const;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('de-DE').format(date);
}

function SortLabel({
  column,
  label,
  activeColumn,
  direction,
  onSort,
  style,
}: {
  column: string;
  label: string;
  activeColumn: string | null;
  direction: 'asc' | 'desc';
  onSort?: (column: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const active = activeColumn === column;
  return (
    <Pressable onPress={() => onSort?.(column)} style={[styles.headerCell, style]} accessibilityRole="button">
      <Text style={[styles.headerLabel, active && styles.headerLabelActive]}>
        {label} {active ? (direction === 'asc' ? '↑' : '↓') : ''}
      </Text>
    </Pressable>
  );
}

export function ClientsListTable({
  clients,
  selectedId = null,
  onClientPress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: ClientsListTableProps) {
  return (
    <ClientWorkspacePanel
      eyebrow="Digitale Klient:innenkartei"
      title="Versorgungsübersicht"
      subtitle="Kompakte Akteninformationen mit direktem Zugriff auf den vollständigen Datensatz"
      contentStyle={styles.tableContent}
    >
      <View style={styles.tableHeader}>
        <SortLabel
          column="name"
          label="Klient:in"
          activeColumn={sortColumnKey}
          direction={sortDirection}
          onSort={onSortColumn}
          style={styles.identityColumn}
        />
        <View style={[styles.headerCell, styles.careColumn]}><Text style={styles.headerLabel}>Versorgung</Text></View>
        <SortLabel
          column="city"
          label="Kontakt & Ort"
          activeColumn={sortColumnKey}
          direction={sortDirection}
          onSort={onSortColumn}
          style={styles.contactColumn}
        />
        <View style={[styles.headerCell, styles.statusColumn]}><Text style={styles.headerLabel}>Status</Text></View>
        <View style={[styles.headerCell, styles.updatedColumn]}><Text style={styles.headerLabel}>Aktualisiert</Text></View>
        <View style={[styles.headerCell, styles.actionColumn]}><Text style={styles.headerLabel}>Aktion</Text></View>
      </View>

      <View style={styles.rows}>
        {clients.map((item) => {
          const fullName = `${item.firstName} ${item.lastName}`.trim();
          const selected = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onClientPress?.(item.id)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={[styles.cell, styles.identityColumn, styles.identity]}>
                <ClientAnimalAvatar clientId={item.id} clientName={fullName} size={44} />
                <View style={styles.identityText}>
                  <Text style={styles.name} numberOfLines={1}>{item.lastName}, {item.firstName}</Text>
                  <Text style={styles.meta} numberOfLines={1}>Geb. {formatDate(item.dateOfBirth)}</Text>
                </View>
              </View>
              <View style={[styles.cell, styles.careColumn]}>
                <Text style={styles.cellPrimary}>{item.careLevel ? formatCareLevel(item.careLevel) : 'Ohne Pflegegrad'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{item.costCarrier ?? 'Kostenträger offen'}</Text>
              </View>
              <View style={[styles.cell, styles.contactColumn]}>
                <Text style={styles.cellPrimary} numberOfLines={1}>{[item.zip, item.city].filter(Boolean).join(' ') || 'Ort offen'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{item.primaryContactPhone ?? 'Keine Telefonnummer'}</Text>
              </View>
              <View style={[styles.cell, styles.statusColumn]}>
                <AuroraBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant={statusVariant(item.status)} dot />
              </View>
              <View style={[styles.cell, styles.updatedColumn]}>
                <Text style={styles.cellPrimary}>{formatDate(item.updatedAt)}</Text>
                <Text style={styles.meta}>Aktenstand</Text>
              </View>
              <View style={[styles.cell, styles.actionColumn]}>
                <ClientWorkspaceButton
                  label="Akte öffnen"
                  variant="secondary"
                  compact
                  onPress={() => (onOpenDetail ?? onClientPress)?.(item.id)}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </ClientWorkspacePanel>
  );
}

const styles = StyleSheet.create({
  tableContent: { gap: 0 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: careSpacing.sm,
    paddingBottom: careSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: systemLiquidGlass.borderStrong,
    gap: careSpacing.xs,
  },
  headerCell: { justifyContent: 'center', minWidth: 0 },
  headerLabel: {
    color: '#34445A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerLabelActive: { color: SYSTEM_LIQUID_COLORS.electricBlue },
  rows: { gap: 7, paddingTop: careSpacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    gap: careSpacing.xs,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    backgroundColor: '#FFFFFF',
  },
  rowSelected: {
    borderColor: SYSTEM_LIQUID_COLORS.electricBlue,
    backgroundColor: systemLiquidGlass.rowSelected,
  },
  rowPressed: { opacity: 0.8 },
  cell: { justifyContent: 'center', minWidth: 0, gap: 3 },
  identityColumn: { flex: 1.7 },
  careColumn: { flex: 1.15 },
  contactColumn: { flex: 1.25 },
  statusColumn: { flex: 0.9 },
  updatedColumn: { flex: 0.78 },
  actionColumn: { width: 132, alignItems: 'flex-end' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.sm },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    color: SYSTEM_LIQUID_COLORS.navy,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  cellPrimary: {
    color: SYSTEM_LIQUID_COLORS.navy,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  meta: {
    color: '#34445A',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
