import { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLayout, ErrorState, GlassCard, InputField, PremiumButton } from '@/design/components';
import { validatePortalCodeLogin } from '@/lib/auth/clientPortalAuthService';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { isDemoMode } from '@/lib/supabase/config';

function openHelp() {
  void Linking.openURL(SUPPORT_LINKS.help).catch(() => undefined);
}

export function PortalCodeLoginScreen() {
  const router = useRouter();
  const { signInDemo, signInPortalSession } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await validatePortalCodeLogin(code, 'client');
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.portalSession) {
      await signInPortalSession(result.data.portalSession);
    } else if (isDemoMode()) {
      await signInDemo('client_portal');
    }
    router.replace(resolvePostLoginRoute('client_portal'));
  };

  return (
    <AuthLayout
      title="Klient:innen / Angehörige"
      subtitle="Portal-Code oder Einladung von Ihrer Einrichtung"
      keyboardAvoiding
    >
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <GlassCard>
        <InputField
          label="Portal-Code oder Einladung"
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
