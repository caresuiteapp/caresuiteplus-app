import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard } from '@/components/ui';
import type { AccessCredentialsReveal } from '@/lib/auth/auth.types';
import { colors, spacing, typography } from '@/theme';

type AccessCredentialsPanelProps = {
  title: string;
  credentials: AccessCredentialsReveal;
  onClose: () => void;
  onCopy?: () => void;
};

export function AccessCredentialsPanel({
  title,
  credentials,
  onClose,
  onCopy,
}: AccessCredentialsPanelProps) {
  return (
    <PremiumCard accentColor={colors.success}>
      <Text style={styles.title}>{title}</Text>
      {credentials.username ? (
        <Text style={styles.row}>Benutzername: {credentials.username}</Text>
      ) : null}
      {credentials.oneTimePassword ? (
        <Text style={styles.row}>Einmalpasswort: {credentials.oneTimePassword}</Text>
      ) : null}
      {credentials.portalCode ? (
        <Text style={styles.row}>Portal-Code: {credentials.portalCode}</Text>
      ) : null}
      {credentials.expiresAt ? (
        <Text style={styles.hint}>Gültig bis: {new Date(credentials.expiresAt).toLocaleDateString('de-DE')}</Text>
      ) : null}
      <Text style={styles.warning}>
        Das Einmalpasswort bzw. der Code wird aus Sicherheitsgründen nur einmal angezeigt.
      </Text>
      <View style={styles.actions}>
        {onCopy ? <PremiumButton title="Kopieren" onPress={onCopy} fullWidth /> : null}
        <PremiumButton title="Schließen" variant="secondary" onPress={onClose} fullWidth />
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, marginBottom: spacing.sm },
  row: { ...typography.body, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  warning: { ...typography.caption, color: colors.orange, marginBottom: spacing.md },
  actions: { gap: spacing.sm },
});
