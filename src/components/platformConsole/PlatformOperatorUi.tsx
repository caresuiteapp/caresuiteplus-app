import { StyleSheet, Text, View } from 'react-native';
import { PLATFORM_COLORS } from './PlatformColors';
import { spacing } from '@/theme';

export function PlatformStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.badge, { borderColor: tone.border, backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label ?? statusLabel(status)}</Text>
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

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv', enabled: 'Aktiv', available: 'Verfügbar', succeeded: 'Erfolgreich', paid: 'Bezahlt', open: 'Offen',
  failed: 'Fehlgeschlagen', past_due: 'Überfällig', chargeback: 'Rückbuchung', suspended: 'Gesperrt', revoked: 'Widerrufen',
  cancelled: 'Storniert', pending: 'Ausstehend', draft: 'Entwurf', scheduled: 'Geplant', trial: 'Testphase',
  live: 'Live', onboarding: 'Einrichtung', closed: 'Beendet', refunded: 'Erstattet', partially_paid: 'Teilbezahlt',
  disabled: 'Deaktiviert', terminated: 'Beendet', locked: 'Gesperrt', manual_free: 'Kostenfrei', invoice_pending: 'Rechnung offen',
};

export function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  return STATUS_LABELS[normalized] ?? status.replaceAll('_', ' ');
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontSize: 11, fontWeight: '700' },
  banner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: spacing.sm,
  },
  bannerText: { color: '#1E40AF', fontSize: 12, lineHeight: 18 },
});
