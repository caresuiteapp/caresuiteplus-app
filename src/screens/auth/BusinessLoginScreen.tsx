import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { loginBusinessUser } from '@/lib/auth/businessAuthService';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { useAuth } from '@/lib/auth/context';
import { isDemoMode } from '@/lib/supabase/config';

export function BusinessLoginScreen() {
  const router = useRouter();
  const { signInDemo } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await loginBusinessUser(identifier, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.tenantUser && isDemoMode()) {
      await signInDemo('business_admin');
    }

    setSuccess(true);
    setTimeout(() => router.replace(resolvePostLoginRoute('business')), 400);
  };

  return (
    <CareLightPageShell title="Unternehmen / Verwaltung" subtitle="Interner Mandantenzugang" scroll>
      <AuthLoginHero
        eyebrow="BUSINESS LOGIN"
        title="Unternehmen / Verwaltung"
        subtitle="Dieser Zugang ist für Unternehmen, Verwaltung und interne Benutzer."
        portalLabel="Business Login"
        portalVariant="orange"
        icon="🏢"
      />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? <SuccessState message="Anmeldung erfolgreich — Weiterleitung…" /> : null}
      <PremiumInput label="Benutzername oder E-Mail" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
      <PremiumInput label="Passwort" value={password} onChangeText={setPassword} secureTextEntry />
      <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
      <PremiumButton title="Passwort vergessen" variant="secondary" onPress={() => router.push('/auth/forgot-password' as never)} fullWidth />
    </CareLightPageShell>
  );
}
