import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthLoginHero } from '@/components/auth/AuthLoginHero';
import { ErrorState, LoadingState, PremiumButton, SuccessState } from '@/components/ui';
import { AuthPageShell, InputField } from '@/design/components';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { getServiceMode } from '@/lib/services/mode';
import { getSession, signOut, updatePassword } from '@/lib/supabase/authService';
import { getSupabaseClient } from '@/lib/supabase/client';

export function ResetPasswordScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    async function loadSession() {
      if (getServiceMode() !== 'supabase') {
        if (active) {
          setReady(true);
          setHasSession(false);
        }
        return;
      }

      const result = await getSession();
      if (!active) return;
      if (result.ok && result.data) {
        setReady(true);
        setHasSession(true);
      }
    }

    void loadSession();

    if (!client) {
      return () => {
        active = false;
      };
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setHasSession(Boolean(session));
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (newPassword.length < 10) {
      setError('Das neue Passwort muss mindestens 10 Zeichen haben.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(newPassword);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await signOut();
    setSuccess(true);
    setTimeout(() => router.replace('/auth/business-login' as never), 1200);
  };

  if (!ready) {
    return (
      <AuthPageShell title="Neues Passwort" subtitle="Wird geladen…">
        <LoadingState message="Rücksetz-Link wird geprüft…" />
      </AuthPageShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthPageShell title="Neues Passwort" subtitle="Link ungültig">
        <ErrorState
          message="Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an."
          onRetry={() => router.replace('/auth/forgot-password' as never)}
        />
        <PremiumButton
          title="Neuen Link anfordern"
          onPress={() => router.replace('/auth/forgot-password' as never)}
          fullWidth
        />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Neues Passwort" subtitle="Passwort festlegen" keyboardAvoiding>
      <AuthLoginHero
        eyebrow="PASSWORT"
        title="Neues Passwort festlegen"
        subtitle="Bitte vergeben Sie ein neues Passwort für Ihren Zugang."
        portalLabel="Business Login"
        portalVariant="orange"
        icon="🔑"
      />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? (
        <SuccessState message="Passwort gespeichert — Weiterleitung zum Login…" />
      ) : null}
      <InputField label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <InputField
        label="Passwort bestätigen"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <PremiumButton title="Passwort speichern" onPress={handleSubmit} loading={loading} fullWidth />
      <PremiumButton
        title="Zum Dashboard"
        variant="secondary"
        onPress={() => router.replace(resolvePostLoginRoute('business'))}
        fullWidth
      />
    </AuthPageShell>
  );
}
