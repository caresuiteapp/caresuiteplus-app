import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import {
  authenticatePortalFace,
  getPortalFaceAvailability,
  isPortalFaceUnlockEnabled,
  setPortalFaceUnlockEnabled,
  type PortalFaceAvailability,
} from '@/lib/auth/portalBiometricService';

export function PortalBiometricSettingsCard() {
  const { portalSession } = useAuth();
  const { colors, typography } = useLegacyTheme();
  const [availability, setAvailability] = useState<PortalFaceAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const accountId = portalSession?.accountId ?? null;

  const refresh = useCallback(async () => {
    if (!accountId || Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const [nextAvailability, nextEnabled] = await Promise.all([
        getPortalFaceAvailability(),
        isPortalFaceUnlockEnabled(accountId),
      ]);
      setAvailability(nextAvailability);
      setEnabled(nextEnabled);
    } catch {
      setAvailability(null);
      setEnabled(false);
      setFeedback('Der geschützte Gerätespeicher konnte nicht geöffnet werden. Bitte entsperren Sie das Gerät vollständig und versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = useCallback(async () => {
    if (!accountId || loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      if (enabled) {
        await setPortalFaceUnlockEnabled(accountId, false);
        setEnabled(false);
        setFeedback('Biometrische Entsperrung wurde auf diesem Gerät deaktiviert.');
        return;
      }

      const nextAvailability = await getPortalFaceAvailability();
      setAvailability(nextAvailability);
      if (!nextAvailability.available) {
        setFeedback(nextAvailability.reason);
        return;
      }

      const result = await authenticatePortalFace();
      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      await setPortalFaceUnlockEnabled(accountId, true);
      setEnabled(true);
      setFeedback('Biometrische Entsperrung ist für dieses Gerät aktiviert.');
    } catch {
      setFeedback('Biometrie konnte auf diesem Gerät nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  }, [accountId, enabled, loading]);

  if (Platform.OS === 'web' || !accountId) return null;

  const status = enabled
    ? 'Aktiv auf diesem Gerät'
    : availability?.available
      ? 'Verfügbar, noch nicht aktiviert'
      : 'Auf diesem Gerät nicht verfügbar';

  return (
    <GlassCard accentColor={enabled ? portalPremium.accent.success : portalPremium.accent.blue}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Biometrische Entsperrung</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Entsperrt die installierte CareSuite-App beim Start und nach längerer Unterbrechung.
            Die App nutzt den sicheren Systemdialog für Gesicht, Fingerabdruck oder Gerätecode.
            Biometrische Daten bleiben ausschließlich im geschützten Systembereich Ihres Geräts.
          </Text>
        </View>
        <View
          accessibilityRole="text"
          style={[
            styles.status,
            { backgroundColor: enabled ? `${colors.success}18` : `${colors.primary}12` },
          ]}
        >
          <Text
            style={[
              typography.caption,
              { color: enabled ? colors.success : colors.textSecondary },
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      {!enabled && availability?.reason ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>{availability.reason}</Text>
      ) : null}
      {feedback ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.caption, { color: enabled ? colors.success : colors.textSecondary }]}
        >
          {feedback}
        </Text>
      ) : null}

      <PremiumButton
        title={enabled ? 'Biometrie deaktivieren' : 'Biometrie aktivieren'}
        variant={enabled ? 'secondary' : 'primary'}
        size="sm"
        loading={loading}
        disabled={!enabled && availability !== null && !availability.available}
        onPress={() => void handleToggle()}
        style={styles.button}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: careSpacing.sm,
  },
  heading: {
    gap: careSpacing.xs,
  },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 6,
  },
  button: {
    alignSelf: 'flex-start',
  },
});
