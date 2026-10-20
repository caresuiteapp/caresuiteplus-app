import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { RememberedPortalLoginControls } from '@/components/auth/RememberedPortalLoginControls';
import { saveRememberedPortalLogin, type RememberedPortalLogin } from '@/lib/auth/rememberedPortalLogin';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareSuiteLogo } from '@/components/brand';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  PremiumButton,
} from '@/design/components';
import { careSpacing } from '@/design/tokens/spacing';
import { loginClientPortal } from '@/lib/auth/clientPortalAuthService';
import { sanitizePortalUsernameInput } from '@/lib/auth/clientPortalUsernameGenerator';
import { completePortalLogin } from '@/lib/auth/portalLoginFlow';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { markPortalWelcomePending } from '@/lib/auth/portalWelcomeSession';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function PortalCodeLoginScreen() {
  const router = useRouter();
  const { signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (saved?: RememberedPortalLogin) => {
    if (submitting.current) return;
    submitting.current = true;
    const loginUsername = saved?.username ?? username;
    const loginSecret = saved?.secret ?? code;
    try {
    setError(null);
    setLoading(true);
    const result = await loginClientPortal(loginUsername, loginSecret);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (!result.data.portalSession) {
      setError(
        'Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten oder fordern Sie Hilfe an.',
      );
      return;
    }

    if (saved && (result.data.portalSession.accountId !== saved.accountId || result.data.portalSession.tenantId !== saved.tenantId)) {
      setError('Das gespeicherte Konto stimmt nicht mehr überein. Bitte normal anmelden.');
      return;
    }

    const completed = await completePortalLogin(result.data.portalSession, {
      supabaseAccessToken: result.data.supabaseAccessToken,
      supabaseRefreshToken: result.data.supabaseRefreshToken,
    });
    if (!completed.ok) {
      setError(completed.error);
      return;
    }

    if (remember && !saved && !completed.data.portalSession.mustChangePassword) {
      try {
        await saveRememberedPortalLogin({ version: 1, kind: 'client', accountId: completed.data.portalSession.accountId, tenantId: completed.data.portalSession.tenantId, username: loginUsername, secret: loginSecret });
      } catch { Alert.alert('Anmeldung nicht gespeichert', 'Sie werden angemeldet. Die Zugangsdaten konnten auf diesem Gerät nicht gespeichert werden.'); }
    }

    try {
      await signInPortalSession(completed.data.portalSession);
      markPortalWelcomePending('client');
      router.replace(resolvePostLoginRoute('client_portal') as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
    } catch {
      setError('Die Anmeldung konnte gerade nicht abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Anmeldung Klientenportal"
      subtitle="Persönlicher Zugang für Klient:innen"
      keyboardAvoiding
    >
      <View style={styles.logoWrap}>
        <CareSuiteLogo size="md" />
      </View>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <GlassCard glow accentColor="#FFD166">
        <InputField
          label="Benutzername"
          value={username}
          onChangeText={(value) => setUsername(sanitizePortalUsernameInput(value))}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          importantForAutofill="yes"
        />
        <InputField
          label="Portal-Code (6-stellig)"
          value={code}
          onChangeText={(value) => setCode(normalizePortalCodeInput(value))}
          autoCapitalize="characters"
          maxLength={6}
          secureTextEntry
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          importantForAutofill="yes"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
        />
        <RememberedPortalLoginControls kind="client" remember={remember} onRememberChange={setRemember} onLogin={handleSubmit} busy={loading} />
      <PremiumButton title="Einloggen" onPress={() => void handleSubmit()} loading={loading} fullWidth />
        <PremiumButton
          title="Hilfe anfordern"
          variant="secondary"
          onPress={() => openExternal(SUPPORT_LINKS.help)}
          fullWidth
        />
      </GlassCard>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
