import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { CareSuiteLogo } from '@/components/brand';
import { AuthLayout } from '@/design/components/AuthLayout';
import { ErrorState, PremiumButton, PremiumInput } from '@/components/ui';
import { loginEmployeePortal } from '@/lib/auth/employeePortalAuthService';
import { completePortalLogin } from '@/lib/auth/portalloginflow';
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

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await loginEmployeePortal(username, password);
    setLoading(false);

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

    const completed = await completePortalLogin(result.data.portalSession, {
      supabaseAccessToken: result.data.supabaseAccessToken,
      supabaseRefreshToken: result.data.supabaseRefreshToken,
    });
    if (!completed.ok) {
      setError(completed.error);
      return;
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
      <PremiumInput label="Benutzername" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <PremiumInput label="Passwort / Einmalpasswort" value={password} onChangeText={setPassword} secureTextEntry />
      <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
