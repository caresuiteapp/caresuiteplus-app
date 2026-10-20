import { StyleSheet, Text, View } from 'react-native';
import type { TenantIkProfile } from '@/types/connect/billing';
import { InfoBanner } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type Props = {
  profile: TenantIkProfile | null;
};

export function TenantIkProfilePanel({ profile }: Props) {
  const verified = profile?.verificationStatus === 'verified';
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>IK-Profil prüfen</Text>
      <InfoBanner
        title={profile?.ikNumber ? 'IK hinterlegt' : 'Kein IK hinterlegt'}
        message={
          profile?.ikNumber
            ? `IK ${profile.ikNumber} — Verifizierung: ${profile.verificationStatus}`
            : 'Ohne Institutionskennzeichen ist keine Abrechnungsvorbereitung möglich.'
        }
      />
      <View style={styles.grid}>
        <Text style={styles.row}>Genehmigung: {profile?.approvalStatus ?? 'pending'}</Text>
        <Text style={styles.row}>Abrechnungsart: {profile?.billingType ?? '—'}</Text>
        <Text style={styles.row}>Modus: {profile?.billingMode ?? '—'}</Text>
        <Text style={styles.row}>
          Bankverbindung: {profile?.bankIban ? 'hinterlegt' : 'fehlt'}
        </Text>
      </View>
      {!verified ? (
        <Text style={styles.hint}>
          IK-Prüfung ist vorbereitet — keine automatische Validierung gegen Produktiv-Stammdaten.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  grid: { gap: spacing.xs },
  row: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
});
