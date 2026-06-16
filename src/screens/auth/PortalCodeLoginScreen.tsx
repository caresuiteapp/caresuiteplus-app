import { useState } from 'react';
import { Linking } from 'react-native';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  PremiumButton,
  SuccessState,
} from '@/design/components';
import { loginClientPortal } from '@/lib/auth/clientPortalAuthService';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { sanitizeUsername } from '@/lib/auth/usernameGenerator';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { isDemoMode } from '@/lib/supabase/config';

function openHelp() {
  void Linking.openURL(SUPPORT_LINKS.help).catch(() => undefined);
}

export function PortalCodeLoginScreen() {
  const { signInDemo, signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);
    const result = await loginClientPortal(username, code);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    try {
      if (result.data.portalSession) {
        await signInPortalSession(result.data.portalSession);
      } else if (isDemoMode()) {
        await signInDemo('client_portal');
      } else {
        setError('Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Benutzername und Zugangscode.');
        return;
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
  };

  return (
    <AuthLayout
      title="Klient:innenportal"
      subtitle="Benutzername und Zugangscode von Ihrer Einrichtung"
      keyboardAvoiding
    >
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? <SuccessState message="Anmeldung erfolgreich — Weiterleitung…" /> : null}
      <GlassCard>
        <InputField
          label="Benutzername"
          value={username}
          onChangeText={(value) => setUsername(sanitizeUsername(value))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <InputField
          label="Zugangscode"
          value={code}
          onChangeText={(value) => setCode(normalizePortalCodeInput(value))}
          autoCapitalize="characters"
          maxLength={6}
        />
        <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
        <PremiumButton title="Hilfe anfordern" variant="secondary" onPress={openHelp} fullWidth />
      </GlassCard>
    </AuthLayout>
  );
}
