import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { getPortalSyncStateForVisit } from '@/lib/portal/portalVisibilityService';
import {
  ASSIST_PROOF_PORTAL_RELEASE_LABELS,
  ASSIST_PROOF_STATUS_LABELS,
} from '@/lib/assist/assistProofLabels';
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

const PORTAL_SYNC_STATUS_LABELS: Record<string, string> = {
  ...ASSIST_PROOF_STATUS_LABELS,
  ...ASSIST_PROOF_PORTAL_RELEASE_LABELS,
  unknown: 'Unbekannt',
  pending: 'Ausstehend',
  planned: 'Geplant',
  scheduled: 'Geplant',
  geplant: 'Geplant',
  confirmed: 'Bestätigt',
  bestaetigt: 'Bestätigt',
  in_progress: 'Läuft',
  gestartet: 'Läuft',
  completed: 'Abgeschlossen',
  abgeschlossen: 'Abgeschlossen',
  cancelled: 'Abgesagt',
  canceled: 'Abgesagt',
  storniert: 'Abgesagt',
};

function statusLabel(value: string | null | undefined): string {
  if (!value || value === '—') return 'Nicht vorhanden';
  return PORTAL_SYNC_STATUS_LABELS[value] ?? 'Unbekannter Status';
}

function statusVariant(value: string | null | undefined): 'green' | 'orange' | 'red' | 'muted' {
  const normalized = value ?? '';
  if (['released', 'approved', 'completed', 'abgeschlossen', 'exported'].includes(normalized)) return 'green';
  if (['rejected', 'revoked', 'cancelled', 'canceled', 'storniert'].includes(normalized)) return 'red';
  if (['pending', 'pending_review', 'pending_client_signature', 'draft', 'planned', 'scheduled', 'geplant'].includes(normalized)) return 'orange';
  return 'muted';
}

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
              <PremiumBadge
                label={statusLabel(sync.employeePortalStatus)}
                variant={statusVariant(sync.employeePortalStatus)}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Assist / Nachweis</Text>
              <PremiumBadge
                label={statusLabel(sync.assistProofStatus)}
                variant={statusVariant(sync.assistProofStatus)}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Office-Freigabe</Text>
              <PremiumBadge
                label={statusLabel(sync.officeReleaseStatus)}
                variant={statusVariant(sync.officeReleaseStatus)}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Klient:innen-Portal sichtbar</Text>
              <PremiumBadge
                label={sync.clientPortalVisible ? 'Ja' : 'Nein'}
                variant={sync.clientPortalVisible ? 'green' : 'orange'}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.secondary}>Dokumente</Text>
              <View style={styles.documentStates}>
                <PremiumBadge
                  label={sync.pdfAvailable ? 'PDF vorhanden' : 'PDF fehlt'}
                  variant={sync.pdfAvailable ? 'green' : 'muted'}
                />
                <PremiumBadge
                  label={sync.signatureComplete ? 'Unterschrift vollständig' : 'Unterschrift fehlt'}
                  variant={sync.signatureComplete ? 'green' : 'orange'}
                />
              </View>
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
  documentStates: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
});
