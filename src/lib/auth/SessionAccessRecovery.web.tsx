import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { fetchPlatformCurrentUser } from '@/lib/platformConsole/platformAuthService';
import {
  LiquidBackdrop,
  LiquidButton,
  LiquidLogo,
  LiquidState,
} from '@/liquid-command/components/LiquidPrimitives';
import { useAuth } from './context';
import { withAuthBootstrapTimeout } from './authBootstrapTimeout';

/** A recoverable, closed workspace gate for an unresolved saved identity. */
export function SessionAccessRecovery() {
  const router = useRouter();
  const { user, session, retryProfileBootstrap, signOut } = useAuth();
  const [pending, setPending] = useState<'retry' | 'signout' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [platformAccess, setPlatformAccess] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [platformCheckAttempt, setPlatformCheckAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !session?.accessToken) {
      setPlatformAccess('denied');
      return;
    }

    // Platform accounts deliberately have no company role/tenant. Only the
    // authenticated server RPC can confirm that this identity owns a console
    // access; never infer it from a missing role or editable metadata.
    setPlatformAccess('checking');
    void withAuthBootstrapTimeout(fetchPlatformCurrentUser(), 'Plattformzugang', 4_000)
      .then((result) => {
        if (!cancelled) {
          setPlatformAccess(result.ok && result.data?.status === 'active' ? 'granted' : 'denied');
        }
      })
      .catch(() => { if (!cancelled) setPlatformAccess('denied'); });

    return () => { cancelled = true; };
  }, [user?.id, session?.accessToken, platformCheckAttempt]);

  async function retry() {
    if (pending) return;
    setPending('retry');
    setActionError(null);
    try {
      await retryProfileBootstrap();
      setPlatformCheckAttempt((attempt) => attempt + 1);
    } catch {
      setActionError('Die Sitzung konnte nicht geprüft werden. Bitte versuchen Sie es erneut oder melden Sie sich neu an.');
    } finally {
      setPending(null);
    }
  }

  async function returnToLogin() {
    if (pending) return;
    setPending('signout');
    setActionError(null);
    try {
      await signOut();
      router.replace('/' as never);
    } catch {
      setActionError('Die Sitzung konnte nicht beendet werden. Bitte versuchen Sie es erneut.');
    } finally {
      setPending(null);
    }
  }

  if (platformAccess === 'checking') {
    return <FullScreenLoader message="Zugang wird geprüft…" />;
  }
  if (platformAccess === 'granted') return <Redirect href="/platform" />;

  return (
    <LiquidBackdrop>
      <ScrollView contentContainerStyle={styles.viewport}>
        <View style={styles.content}>
          <LiquidLogo width={240} />
          <LiquidState
            kind="error"
            title="Anmeldung wiederherstellen"
            message={actionError ?? 'Ihre gespeicherte Sitzung konnte keinem freigeschalteten Zugang zugeordnet werden. Prüfen Sie die Sitzung erneut oder melden Sie sich mit Ihrem Zugang für Verwaltung, Mitarbeitende oder Klient:innen neu an.'}
          />
          <LiquidButton
            label="Zu den Anmeldungen"
            fullWidth
            onPress={() => { void returnToLogin(); }}
            loading={pending === 'signout'}
            disabled={pending !== null}
          />
          <LiquidButton
            label="Sitzung erneut prüfen"
            variant="secondary"
            fullWidth
            onPress={() => { void retry(); }}
            loading={pending === 'retry'}
            disabled={pending !== null}
          />
        </View>
      </ScrollView>
    </LiquidBackdrop>
  );
}

const styles = StyleSheet.create({
  viewport: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 16 },
});
