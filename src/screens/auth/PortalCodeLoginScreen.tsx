import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { validatePortalCodeLogin } from '@/lib/auth/clientPortalAuthService';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { useAuth } from '@/lib/auth/context';
import { isDemoMode } from '@/lib/supabase/config';
import { colors, typography } from '@/theme';

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
    <CareLightPageShell title="Klient:innen / Angehörige" subtitle="Portal-Code Login" scroll>
      <AuthLoginHero
        eyebrow="PORTAL-CODE"
        title="Klient:innen / Angehörige"
        subtitle="Der Portal-Code wird Ihnen von Ihrer Betreuungseinrichtung oder Verwaltung bereitgestellt."
        portalLabel="6-stelliger Code"
        portalVariant="orange"
        icon="🏠"
      />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <PremiumInput
        label="6-stelliger Code"
        value={code}
        onChangeText={(value) => setCode(normalizePortalCodeInput(value))}
        autoCapitalize="characters"
        maxLength={6}
      />
      <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
    </CareLightPageShell>
  );
}
