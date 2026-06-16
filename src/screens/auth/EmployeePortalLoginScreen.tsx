import { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  PremiumButton,
  SuccessState,
} from '@/design/components';
import { loginEmployeePortal } from '@/lib/auth/employeePortalAuthService';
import { resolveFirstLoginRoute } from '@/lib/auth/loginRouter';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { isDemoMode } from '@/lib/supabase/config';

function openHelp() {
  void Linking.openURL(SUPPORT_LINKS.help).catch(() => undefined);
}

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
    setSuccess(false);
    setLoading(true);
    const result = await loginEmployeePortal(username, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.mustChangePassword) {
      router.replace(`${resolveFirstLoginRoute('employee_portal')}?accountId=${result.data.account.id}` as never);
      return;
    }

    try {
      if (result.data.portalSession) {
        await signInPortalSession(result.data.portalSession);
      } else if (isDemoMode()) {
        await signInDemo('employee_portal');
      } else {
        setError('Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten.');
        return;
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
  };

  return (
    <AuthLayout
      title="Mitarbeiterportal"
      subtitle="Einsätze, Dokumentation, Zeiten und Nachrichten"
      keyboardAvoiding
    >
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? <SuccessState message="Anmeldung erfolgreich — Weiterleitung…" /> : null}
      <GlassCard>
        <InputField
          label="E-Mail oder Mitarbeiter-ID"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <InputField
          label="Passwort oder Portal-Code"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
        <PremiumButton title="Hilfe bei Zugang" variant="secondary" onPress={openHelp} fullWidth />
      </GlassCard>
    </AuthLayout>
  );
}
