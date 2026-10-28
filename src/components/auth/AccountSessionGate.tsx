import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth/context';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { PremiumButton } from '@/components/ui';
import { MfaSettingsCard } from './MfaSettingsCard';
import { readAccountSecurityState, registerCurrentAccountDevice, type AccountSecurityState } from '@/lib/auth/accountSecurityService';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import { isDeviceOffline } from '@/lib/offline/connectivity';
import { authenticatePortalFace } from '@/lib/auth/portalBiometricService';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { matchesOfflineSecurityReceipt } from '@/lib/auth/accountSecurityReceipt';

const INACTIVITY_MS = 10 * 60_000;
const RECEIPT_TTL_MS = 24 * 60 * 60_000;
const FOREGROUND_LOCK_MS = 120_000;
export function AccountSessionGate({ children }: { children: ReactNode }) {
  const { user, profile, portalSession, session, authMode, authReady } = useAuth();
  const startupReady = useAppStartIntroReady();
  if (authMode !== 'supabase' || !user || !session) return <>{children}</>;
  const identity = `${user.id}:${profile?.tenantId ?? portalSession?.tenantId ?? ''}`;
  return <AccountSessionContent key={identity} identity={identity} ready={startupReady && authReady}>{children}</AccountSessionContent>;
}
function AccountSessionContent({ children, identity, ready }: { children: ReactNode; identity: string; ready: boolean }) {
  const { session, portalSession, signOut, retryProfileBootstrap } = useAuth();
  const [state, setState] = useState<AccountSecurityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const active = useRef(true), inFlight = useRef(false), unlockLock = useRef(false);
  const generation = useRef(0);
  const activity = useRef(Date.now()), background = useRef<number | null>(null);
  const receiptKey = `caresuite.security-receipt.${identity.replace(/[^a-zA-Z0-9._-]/g, '.')}`;
  const refresh = useCallback(async () => {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = generation.current;
    const isCurrent = () => active.current && generation.current === requestGeneration;
    try {
      if (isDeviceOffline()) {
        const raw = await sensitiveAuthStorage.getItem(receiptKey);
        const cached = matchesOfflineSecurityReceipt(raw, session?.accessToken ?? '');
        if (!cached) {
          throw new Error('Für dieses Konto ist offline noch keine gültige Gerätefreigabe verfügbar. Bitte einmal mit Internetverbindung anmelden.');
        }
        if (isCurrent()) { setState(cached); setError(null); }
        return;
      }
      const current = await withServiceQueryTimeout(readAccountSecurityState(), 'Sitzungsprüfung', 12_000);
      if (!isCurrent()) return;
      setState(current); setError(null);
      if (current.active && (!current.mfaRequired || current.aal === 'aal2')) {
        await sensitiveAuthStorage.setItem(receiptKey, JSON.stringify({ ...current, validUntil: Date.now() + RECEIPT_TTL_MS }));
        if (!isCurrent()) return;
        // Device registration never grants permissions and uses the active server session.
        await registerCurrentAccountDevice().catch(() => { /* The profile exposes registration errors and retry; metadata failure never revokes an otherwise verified session. */ });
      }
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Die sichere Anmeldung konnte nicht geprüft werden.');
    } finally { if (isCurrent()) inFlight.current = false; }
  }, [ready, receiptKey, session?.accessToken]);
  useEffect(() => {
    active.current = true; generation.current++; inFlight.current = false; setState(null); setError(null); void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { active.current = false; generation.current++; clearInterval(timer); };
  }, [refresh, session?.accessToken]);
  useEffect(() => {
    const timer = setInterval(() => { if (Date.now() - activity.current >= INACTIVITY_MS) setLocked(true); }, 5_000);
    const listener = AppState.addEventListener('change', status => {
      if (status !== 'active') { background.current ??= Date.now(); return; }
      if (!portalSession && background.current && Date.now() - background.current >= FOREGROUND_LOCK_MS) setLocked(true);
      background.current = null; void refresh();
    });
    const markActivity = () => { activity.current = Date.now(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(name, markActivity, { passive: true });
    }
    return () => {
      clearInterval(timer); listener.remove();
      if (typeof document !== 'undefined') for (const name of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.removeEventListener(name, markActivity);
    };
  }, [refresh, portalSession]);
  const workspaceOpened = useRef(false);
  const verified = Boolean(state?.active && (!state.mfaRequired || state.aal === 'aal2'));
  const blocked = !ready || !verified || !!error;
  if (!blocked) workspaceOpened.current = true;
  const securityScreen = blocked ? <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <View style={styles.panel}>
      <Text style={styles.title}>Sichere Anmeldung</Text>
      {!ready || (!state && !error) ? <ActivityIndicator accessibilityLabel="Anmeldung wird geprüft" /> : null}
      {state?.active && state.mfaRequired && state.aal !== 'aal2' ? <MfaSettingsCard required onVerified={() => {
        void (async () => { await retryProfileBootstrap(); await refresh(); })();
      }} /> : null}
      {state && !state.active ? <Text style={styles.text}>Diese Geräteanmeldung wurde beendet. Bitte erneut anmelden.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {error ? <PremiumButton title="Sichere Anmeldung erneut prüfen" onPress={() => void refresh()} /> : null}
      <PremiumButton title="Abmelden" variant="secondary" onPress={() => void signOut()} />
    </View>
  </ScrollView> : null;
  if (!workspaceOpened.current) return securityScreen;
  const obscured = locked || blocked;
  return <View style={styles.root} onStartShouldSetResponderCapture={() => { if (!locked) activity.current = Date.now(); return false; }} onMoveShouldSetResponderCapture={() => { if (!locked) activity.current = Date.now(); return false; }}>
    <View style={styles.root} pointerEvents={obscured ? 'none' : 'auto'} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {blocked ? <View style={styles.overlay} accessibilityViewIsModal>{securityScreen}</View> : locked ? <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.panel}>
        <Text style={styles.title}>CareSuite gesperrt</Text>
        <Text style={styles.text}>Ihre Eingaben bleiben geöffnet. Bestätigen Sie Ihre Identität, um weiterzuarbeiten.</Text>
        {unlockError ? <Text accessibilityRole="alert" style={styles.error}>{unlockError}</Text> : null}
        {Platform.OS !== 'web' ? <PremiumButton title="Mit Gerätecode oder Biometrie entsperren" loading={unlocking} onPress={() => {
          if (unlockLock.current) return; unlockLock.current = true; setUnlocking(true);
          void authenticatePortalFace().then(result => {
            if (!active.current) return;
            if (result.ok) { activity.current = Date.now(); setLocked(false); setError(null); setUnlockError(null); void refresh(); }
            else setUnlockError(result.error);
          }).catch(() => { if (active.current) setUnlockError('Die Gerätebestätigung ist nicht verfügbar. Bitte erneut anmelden.'); })
            .finally(() => { unlockLock.current = false; if (active.current) setUnlocking(false); });
        }} /> : null}
        <PremiumButton title="Abmelden und erneut anmelden" variant="secondary" onPress={() => void signOut()} />
      </View>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, screen: { flexGrow: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F6FB' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100000, backgroundColor: '#F2F6FB', padding: 20, justifyContent: 'center', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 560, padding: 20, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: '#CBD8E6', backgroundColor: '#FFFFFF' },
  title: { fontSize: 24, lineHeight: 32, color: '#10283F', fontWeight: '800' }, text: { fontSize: 16, lineHeight: 24, color: '#304E69' }, error: { fontSize: 16, lineHeight: 24, color: '#A51E35' },
});
