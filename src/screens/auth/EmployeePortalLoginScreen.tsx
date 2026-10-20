import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { RememberedPortalLoginControls } from '@/components/auth/RememberedPortalLoginControls';
import { saveRememberedPortalLogin, type RememberedPortalLogin } from '@/lib/auth/rememberedPortalLogin';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { CareSuiteLogo } from '@/components/brand';
import { AuthLayout } from '@/design/components/AuthLayout';
import { ErrorState, PremiumButton, PremiumInput } from '@/components/ui';
import { loginEmployeePortal } from '@/lib/auth/employeePortalAuthService';
import { completePortalLogin } from '@/lib/auth/portalLoginFlow';
import { markPortalWelcomePending } from '@/lib/auth/portalWelcomeSession';
import { resolveEmployeeFirstLoginHref, resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { useAuth } from '@/lib/auth/context';
import { careSpacing } from '@/design/tokens/spacing';

export function EmployeePortalLoginScreen() {
  const router = useRouter();
  const { signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (saved?: RememberedPortalLogin) => {
    if (submitting.current) return;
    submitting.current = true;
    const loginUsername = saved?.username ?? username;
    const loginSecret = saved?.secret ?? password;
    try {
    setError(null);
    setLoading(true);
    const result = await loginEmployeePortal(loginUsername, loginSecret);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (!result.data.portalSession) {
      setError(
        'Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten oder kontaktieren Sie die Verwaltung.',
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
        await saveRememberedPortalLogin({ version: 1, kind: 'employee', accountId: completed.data.portalSession.accountId, tenantId: completed.data.portalSession.tenantId, username: loginUsername, secret: loginSecret });
      } catch { Alert.alert('Anmeldung nicht gespeichert', 'Sie werden angemeldet. Die Zugangsdaten konnten auf diesem Gerät nicht gespeichert werden.'); }
    }

    try {
      await signInPortalSession(completed.data.portalSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
      return;
    }

    if (result.data.mustChangePassword) {
      router.replace(
        resolveEmployeeFirstLoginHref(result.data.account.id) as never,
      );
      return;
    }

    markPortalWelcomePending('employee');
    router.replace(resolvePostLoginRoute('employee_portal') as never);
    } catch {
      setError('Die Anmeldung konnte gerade nicht abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Mitarbeiterportal" subtitle="Persönlicher Mitarbeiterzugang" scroll>
      <View style={styles.logoWrap}>
        <CareSuiteLogo size="md" />
      </View>
      <AuthLoginHero
        eyebrow="MITARBEITERPORTAL"
        title="Mitarbeiterportal"
        subtitle="Ihr Benutzername und Ihr erstes Passwort werden von Ihrer Verwaltung bereitgestellt."
        portalLabel="Keine öffentliche Registrierung"
        portalVariant="cyan"
        icon="👤"
      />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <PremiumInput
        label="Benutzername"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect={false}
        importantForAutofill="yes"
        returnKeyType="next"
        spellCheck={false}
        textContentType="username"
      />
      <PremiumInput
        label="Passwort / Einmalpasswort"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        importantForAutofill="yes"
        onSubmitEditing={() => void handleSubmit()}
        returnKeyType="go"
        secureTextEntry
        spellCheck={false}
        textContentType="password"
      />
      <RememberedPortalLoginControls kind="employee" remember={remember} onRememberChange={setRemember} onLogin={handleSubmit} busy={loading} />
      <PremiumButton title="Einloggen" onPress={() => void handleSubmit()} loading={loading} fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
