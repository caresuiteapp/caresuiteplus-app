import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchPasswordResetInfo } from '@/lib/auth/passwordResetService';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [contactHint, setContactHint] = useState('');
  const query = useAsyncQuery(() => fetchPasswordResetInfo(), []);

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
        subtitle={info?.message ?? 'Passwort-Rücksetzungen werden über CareSuite+ Office ausgelöst.'}
        portalLabel="Nur für interne Benutzer"
        portalVariant="orange"
        icon="🔑"
        hint="Bitte wenden Sie sich an Ihre Administratorin oder Ihren Administrator."
      />
      {!contactHint.trim() ? (
        <EmptyState
          title="Kontakt erforderlich"
          message="E-Mail oder Benutzername unten erfassen — Rücksetzung erfolgt über Office."
        />
      ) : null}
      <PremiumInput
        label="E-Mail oder Benutzername"
        value={contactHint}
        onChangeText={setContactHint}
        placeholder="name@einrichtung.de"
        autoCapitalize="none"
      />
      <PremiumButton title="Zurück zum Login" variant="secondary" onPress={() => router.back()} fullWidth />
    </ScreenShell>
  );
}

void fetchPasswordResetInfo;
