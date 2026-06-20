import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { getEmployeePortalImpactSummary } from '@/lib/portal/portalVisibilityService';
import { colors, spacing, typography } from '@/theme';

const FIELD_LABELS: Record<string, string> = {
  displayName: 'Name',
  street: 'Straße',
  zip: 'PLZ',
  city: 'Ort',
  phone: 'Telefon',
  accessHint: 'Zugangshinweise',
  emergencyContact: 'Notfallkontakt',
};

/** Office/Akte — what employees see during assigned visits (not full record). */
export function EmployeePortalImpactPanel() {
  const impact = getEmployeePortalImpactSummary();

  return (
    <SectionPanel title="Mitarbeiter:innen-Portal — Einsatzsicht">
      <PremiumCard style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.primary}>Operatives Einsatzportal</Text>
          <PremiumBadge label="Kein Vollzugriff Akte" variant="muted" />
        </View>
        <Text style={styles.secondary}>
          Mitarbeitende sehen nur zugewiesene Einsätze mit freigegebenen Klient:innenfeldern.
        </Text>
        <Text style={styles.secondary}>
          Budget, Rechnungen und vollständige Akte:{' '}
          <Text style={styles.blocked}>blockiert</Text>
        </Text>
        <Text style={styles.secondary}>
          GPS/Tracking: nur im Mitarbeiter:innen-Portal während Einsatzdurchführung (Consent).
        </Text>
      </PremiumCard>

      <PremiumCard style={styles.card}>
        <Text style={styles.primary}>Freigegebene Klient:innenfelder</Text>
        <View style={styles.chips}>
          {impact.allowedClientFields.map((field) => (
            <PremiumBadge key={field} label={FIELD_LABELS[field] ?? field} variant="green" />
          ))}
        </View>
      </PremiumCard>

      <PremiumCard style={styles.card}>
        <Text style={styles.primary}>Blockierte Bereiche</Text>
        <Text style={styles.secondary}>
          {impact.blockedClientFields.slice(0, 6).join(', ')}
          {impact.blockedClientFields.length > 6 ? ' …' : ''}
        </Text>
      </PremiumCard>

      <EmptyState
        title="Mitarbeiter:innen Core folgt später"
        message="Personalakte, Lohn und vollständige HR-Prozesse werden in einem separaten Core-Lauf angebunden."
      />
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  blocked: { color: colors.error, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
});
