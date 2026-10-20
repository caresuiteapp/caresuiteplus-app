import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareSuiteLogo } from '@/components/brand';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  PremiumButton,
  SuccessState,
} from '@/design/components';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { loginBusinessUser } from '@/lib/auth/businessAuthService';
import { markBusinessWelcomePending } from '@/lib/auth/businessWelcomeSession';
import { useAuth } from '@/lib/auth/context';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';

export function BusinessLoginScreen() {
  const router = useRouter();
  const { signInWithSupabaseSession } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const result = await loginBusinessUser(identifier, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (!result.data.supabaseSession) {
        setError(
          'Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten oder kontaktieren Sie den Support.',
        );
        return;
      }

      await signInWithSupabaseSession(result.data.supabaseSession);
      markBusinessWelcomePending();
      setSuccess(true);
      router.replace(resolvePostLoginRoute(result.data.loginType));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Unternehmen / Verwaltung"
      subtitle="Anmeldung für Verwaltung und Geschäftsführung"
      keyboardAvoiding
    >
      <View style={styles.logoWrap}>
        <CareSuiteLogo size="md" />
      </View>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? <SuccessState message="Anmeldung erfolgreich — Weiterleitung…" /> : null}
      <GlassCard glow accentColor={galaxyPalette.careOrange}>
        <InputField label="E-Mail" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
        <InputField label="Passwort" value={password} onChangeText={setPassword} secureTextEntry />
        <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
        <PremiumButton
          title="Passwort vergessen"
          variant="secondary"
          onPress={() => router.push('/auth/forgot-password' as never)}
          fullWidth
        />
      </GlassCard>
      <PremiumButton
        title="Neues Unternehmen registrieren"
        variant="secondary"
        onPress={() => router.push('/auth/register-business' as never)}
        fullWidth
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
