import { StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformShellLayout';
import { spacing } from '@/theme';

export function PlatformStatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.badge, { borderColor: tone.border, backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{status}</Text>
    </View>
  );
}

export function PlatformReadOnlyBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function PlatformDeferredNote({ phase, feature }: { phase: string; feature: string }) {
  return (
    <PlatformReadOnlyBanner
      message={`${feature} — Schreibzugriff folgt in ${phase}. Aktuell nur Lesemodus.`}
    />
  );
}

function statusTone(status: string): { bg: string; border: string; fg: string } {
  const s = status.toLowerCase();
  if (['active', 'enabled', 'succeeded', 'paid', 'open'].includes(s)) {
    return { bg: '#DCFCE7', border: '#86EFAC', fg: '#166534' };
  }
  if (['failed', 'past_due', 'chargeback', 'suspended', 'revoked', 'cancelled'].includes(s)) {
    return { bg: '#FEE2E2', border: '#FCA5A5', fg: '#991B1B' };
  }
  if (['pending', 'draft', 'scheduled'].includes(s)) {
    return { bg: '#FEF3C7', border: '#FCD34D', fg: '#92400E' };
  }
  return { bg: '#F1F5F9', border: PLATFORM_COLORS.border, fg: PLATFORM_COLORS.muted };
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontSize: 11, fontWeight: '600', textTransform: 'lowercase' },
  banner: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    padding: spacing.sm,
  },
  bannerText: { color: PLATFORM_COLORS.muted, fontSize: 12, lineHeight: 18 },
});
