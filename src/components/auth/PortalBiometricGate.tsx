import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PremiumButton } from '@/components/ui';
import { portalPremium } from '@/design/tokens/portalPremium';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import {
  authenticatePortalFace,
  isPortalFaceUnlockEnabled,
  setPortalFaceUnlockEnabled,
  subscribePortalFacePreference,
} from '@/lib/auth/portalBiometricService';

type PortalBiometricGateProps = {
  children: ReactNode;
};

const BACKGROUND_LOCK_AFTER_MS = 120_000;

export function PortalBiometricGate({ children }: PortalBiometricGateProps) {
  const { authReady, portalSession, signOut } = useAuth();
  const { colors, typography } = useLegacyTheme();
  const [checking, setChecking] = useState(false);
  const [checkedAccountId, setCheckedAccountId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  const authenticatingRef = useRef(false);
  const accountId = portalSession?.accountId ?? null;
  const native = Platform.OS === 'android' || Platform.OS === 'ios';

  const unlock = useCallback(async () => {
    if (!accountId || authenticatingRef.current) return;
    authenticatingRef.current = true;
    setAuthenticating(true);
    setError(null);
    const result = await authenticatePortalFace();
    authenticatingRef.current = false;
    setAuthenticating(false);
    if (result.ok) {
      setLocked(false);
      return;
    }
    setLocked(true);
    setError(result.error);
  }, [accountId]);

  useEffect(() => {
    if (!native || !authReady || !accountId) {
      setChecking(false);
      setCheckedAccountId(null);
      setEnabled(false);
      setLocked(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void isPortalFaceUnlockEnabled(accountId).then((preferenceEnabled) => {
      if (cancelled) return;
      setChecking(false);
      setCheckedAccountId(accountId);
      setEnabled(preferenceEnabled);
      setLocked(preferenceEnabled);
      if (preferenceEnabled) void unlock();
    });

    return () => {
      cancelled = true;
    };
  }, [accountId, authReady, native, unlock]);

  useEffect(
    () =>
      subscribePortalFacePreference((changedAccountId, preferenceEnabled) => {
        if (changedAccountId !== accountId) return;
        setEnabled(preferenceEnabled);
        // Enabling already required a successful system prompt in the profile.
        setLocked(false);
        setError(null);
      }),
    [accountId],
  );

  useEffect(() => {
    if (!native || !enabled || !accountId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (authenticatingRef.current) return;
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current ??= Date.now();
        return;
      }
      if (nextState !== 'active') return;

      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (backgroundedAt && Date.now() - backgroundedAt >= BACKGROUND_LOCK_AFTER_MS) {
        setLocked(true);
        void unlock();
      }
    });

    return () => subscription.remove();
  }, [accountId, enabled, native, unlock]);

  useEffect(() => {
    if (!enabled || !accountId) return;
    void (async () => {
      const stillEnabled = await isPortalFaceUnlockEnabled(accountId);
      if (!stillEnabled) {
        await setPortalFaceUnlockEnabled(accountId, false);
        setEnabled(false);
        setLocked(false);
      }
    })();
  }, [accountId, enabled]);

  if (!native || !accountId) {
    return <>{children}</>;
  }

  const preferencePending = !authReady || checking || checkedAccountId !== accountId;
  if (!preferencePending && (!enabled || !locked)) return <>{children}</>;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: portalPremium.backdrop }]}>
      <View style={styles.panel} accessibilityViewIsModal>
        {preferencePending ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <View style={styles.copy}>
              <Text style={[typography.display, styles.center, { color: colors.textPrimary }]}>CareSuite gesperrt</Text>
              <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>
                Bestätigen Sie Ihr Gesicht mit dem sicheren Systemdialog, um persönliche Portal- und Gesundheitsdaten anzuzeigen.
              </Text>
              {error ? (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={[typography.caption, styles.center, { color: colors.danger }]}
                >
                  {error}
                </Text>
              ) : null}
            </View>
            <PremiumButton
              title="Mit Gesicht entsperren"
              onPress={() => void unlock()}
              loading={authenticating}
              fullWidth
            />
            <PremiumButton
              title="Abmelden und normal anmelden"
              variant="secondary"
              disabled={authenticating}
              onPress={() => void signOut()}
              fullWidth
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: careSpacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    gap: careSpacing.md,
    padding: careSpacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.surface,
  },
  copy: {
    gap: careSpacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});
