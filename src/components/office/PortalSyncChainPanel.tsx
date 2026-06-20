import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { getPortalSyncStateForVisit } from '@/lib/portal/portalVisibilityService';
import { colors, spacing, typography } from '@/theme';

type SyncRow = {
  visitId: string;
  assignmentId?: string | null;
  employeePortalStatus?: string;
  assistProofStatus?: string | null;
  officeReleaseStatus?: string | null;
  portalVisible?: boolean;
  pdfStoragePath?: string | null;
  signatureComplete?: boolean;
  label?: string;
};

type Props = {
  rows?: SyncRow[];
};

/** Office/Akte — portal sync chain per visit/proof. */
export function PortalSyncChainPanel({ rows = [] }: Props) {
  if (rows.length === 0) {
    return (
      <SectionPanel title="Portal-Sync-Kette">
        <EmptyState
          title="Keine Einsätze mit Nachweis"
          message="Sobald Einsätze mit Nachweisen vorliegen, erscheint hier die Kette Mitarbeiter:innen-Portal → Assist → Office → Klient:innen-Portal."
        />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Portal-Sync-Kette">
      {rows.map((row) => {
        const sync = getPortalSyncStateForVisit(row);
        return (
          <PremiumCard key={row.visitId} style={styles.card}>
            <Text style={styles.primary}>{row.label ?? `Einsatz ${row.visitId.slice(0, 8)}`}</Text>
            <View style={styles.row}>
              <Text style={styles.secondary}>Mitarbeiter:innen-Portal</Text>
              <PremiumBadge label={sync.employeePortalStatus} variant="muted" />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Assist / Nachweis</Text>
              <PremiumBadge label={sync.assistProofStatus ?? '—'} variant="muted" />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Office-Freigabe</Text>
              <PremiumBadge label={sync.officeReleaseStatus ?? '—'} variant="muted" />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Klient:innen-Portal sichtbar</Text>
              <PremiumBadge
                label={sync.clientPortalVisible ? 'Ja' : 'Nein'}
                variant={sync.clientPortalVisible ? 'green' : 'orange'}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>PDF / Signatur</Text>
              <Text style={styles.secondary}>
                PDF {sync.pdfAvailable ? '✓' : '—'} · Signatur {sync.signatureComplete ? '✓' : '—'}
              </Text>
            </View>
          </PremiumCard>
        );
      })}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted },
});
