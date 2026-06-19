import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { CareSuiteLogo } from '@/components/brand';
import { CareLightPageShell } from '@/components/layout';
import { ErrorState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { loginEmployeePortal } from '@/lib/auth/employeePortalAuthService';
import { resolveFirstLoginRoute, resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { useAuth } from '@/lib/auth/context';
import { isDemoMode } from '@/lib/supabase/config';
import { careSpacing } from '@/design/tokens/spacing';

export function EmployeePortalLoginScreen() {
  const router = useRouter();
  const { signInDemo, signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await loginEmployeePortal(username, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.portalSession) {
      await signInPortalSession(result.data.portalSession);
    } else if (isDemoMode()) {
      await signInDemo('employee_portal');
    }

    if (result.data.mustChangePassword) {
      router.replace(`${resolveFirstLoginRoute('employee_portal')}?accountId=${result.data.account.id}` as never);
      return;
    }

    router.replace(resolvePostLoginRoute('employee_portal'));
    setSuccess(true);
  };

  return (
    <CareLightPageShell title="Mitarbeiterportal" subtitle="Persönlicher Mitarbeiterzugang" scroll>
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
      {success ? <SuccessState message="Anmeldung erfolgreich — Weiterleitung…" /> : null}
      <PremiumInput label="Benutzername" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <PremiumInput label="Passwort / Einmalpasswort" value={password} onChangeText={setPassword} secureTextEntry />
      <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
