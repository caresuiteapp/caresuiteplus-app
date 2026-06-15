import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  fetchPasswordResetInfo,
  requestBusinessPasswordReset,
} from '@/lib/auth/passwordResetService';
import { getServiceMode } from '@/lib/services/mode';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const query = useAsyncQuery(() => fetchPasswordResetInfo(), []);
  const isLive = getServiceMode() === 'supabase';

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    const result = await requestBusinessPasswordReset(email);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccessMessage(result.data.message);
  };

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Passwort vergessen" subtitle="Wird geladen…" scroll>
        <LoadingState message="Informationen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Passwort vergessen" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const info = query.data;

  return (
    <ScreenShell title="Passwort vergessen" subtitle="Zugang zurücksetzen" scroll>
      <AuthLoginHero
        eyebrow="PASSWORT"
        title="Passwort vergessen"
        subtitle={info?.message ?? 'Passwort zurücksetzen'}
        portalLabel={isLive ? 'Supabase Auth' : 'Nur für interne Benutzer'}
        portalVariant="orange"
        icon="🔑"
        hint={
          isLive
            ? 'Der Link zum neuen Passwort wird an Ihre E-Mail-Adresse gesendet.'
            : 'Bitte wenden Sie sich an Ihre Administratorin oder Ihren Administrator.'
        }
      />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {successMessage && isLive ? (
        <PremiumButton
          title="SSL-Fehler? Link lokal übernehmen"
          variant="secondary"
          onPress={() => router.push('/auth/recovery-bridge' as never)}
          fullWidth
        />
      ) : null}
      <PremiumInput
        label="E-Mail-Adresse"
        value={email}
        onChangeText={setEmail}
        placeholder="name@einrichtung.de"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {isLive ? (
        <PremiumButton
          title="Link zum Zurücksetzen senden"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
        />
      ) : null}
      <PremiumButton title="Zurück zum Login" variant="secondary" onPress={() => router.back()} fullWidth />
    </ScreenShell>
  );
}
