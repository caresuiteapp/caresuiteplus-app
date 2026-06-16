import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/design/components';
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
      <AuthLayout title="Passwort vergessen" subtitle="Wird geladen…" scroll>
        <LoadingState message="Informationen werden geladen…" />
      </AuthLayout>
    );
  }

  if (query.error && !query.data) {
    return (
      <AuthLayout title="Passwort vergessen" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </AuthLayout>
    );
  }

  const info = query.data;

  return (
    <AuthLayout title="Passwort vergessen" subtitle="Zugang zurücksetzen" scroll keyboardAvoiding>
      <AuthLoginHero
        eyebrow="PASSWORT"
        title="Passwort vergessen"
        subtitle={info?.message ?? 'Passwort zurücksetzen'}
        portalLabel={isLive ? 'E-Mail-Zugang' : 'Nur für interne Benutzer'}
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
      <GlassCard>
        <InputField
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
      </GlassCard>
    </AuthLayout>
  );
}
