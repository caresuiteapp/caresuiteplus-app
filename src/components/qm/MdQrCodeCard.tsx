import { StyleSheet, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PremiumCard } from '@/components/ui';
import type { MdShareToken } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = { token: MdShareToken };

export function MdQrCodeCard({ token }: Props) {
  const expired = new Date(token.expiresAt) < new Date();
  const revoked = !!token.revokedAt;

  return (
    <PremiumCard accentColor={colors.cyan}>
      <PreparedModeBanner hint="QR-Code zeigt vorbereitete URL — kein echter PDF-Download." />
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrIcon}>▦</Text>
        <Text style={styles.qrLabel}>QR (P-READY)</Text>
      </View>
      <Text style={styles.url}>{token.shareUrl}</Text>
      <Text style={styles.token}>Token: {token.token}</Text>
      <Text style={styles.meta}>
        Gültig bis: {new Date(token.expiresAt).toLocaleDateString('de-DE')}
        {revoked && ' · Widerrufen'}
        {expired && !revoked && ' · Abgelaufen'}
      </Text>
      <Text style={styles.access}>Zugriffe: {token.accessCount}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  qrIcon: { fontSize: 48, color: colors.textMuted },
  qrLabel: { ...typography.caption, color: colors.textMuted },
  url: { ...typography.bodyStrong, marginBottom: spacing.xs },
  token: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  access: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
