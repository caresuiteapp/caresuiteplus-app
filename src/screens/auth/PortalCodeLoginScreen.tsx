import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareSuiteLogo } from '@/components/brand';
import {
  AuthLayout,
  ErrorState,
  GlassCard,
  InputField,
  PremiumButton,
} from '@/design/components';
import { careSpacing } from '@/design/tokens/spacing';
import { loginClientPortal } from '@/lib/auth/clientPortalAuthService';
import { sanitizePortalUsernameInput } from '@/lib/auth/clientPortalUsernameGenerator';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { completePortalLogin } from '@/lib/auth/portalloginflow';
import { normalizePortalCodeInput } from '@/lib/auth/portalCodeGenerator';
import { useAuth } from '@/lib/auth/context';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { isDemoMode } from '@/lib/supabase/config';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function PortalCodeLoginScreen() {
  const router = useRouter();
  const { signInDemo, signInPortalSession } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    const result = await loginClientPortal(username, code);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.portalSession) {
      const completed = await completePortalLogin(result.data.portalSession, {
        supabaseAccessToken: result.data.supabaseAccessToken,
        supabaseRefreshToken: result.data.supabaseRefreshToken,
      });
      if (!completed.ok) {
        setError(completed.error);
        return;
      }
      await signInPortalSession(completed.data.portalSession);
    } else if (isDemoMode()) {
      await signInDemo('client_portal');
    } else {
      setError(
        'Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten oder fordern Sie Hilfe an.',
      );
      return;
    }

    router.replace(resolvePostLoginRoute('client_portal'));
  };

  return (
    <AuthLayout
      title="Anmeldung Klient:innen Portal"
      subtitle="Persönlicher Zugang für Klient:innen"
      keyboardAvoiding
    >
      <View style={styles.logoWrap}>
        <CareSuiteLogo size="md" />
      </View>
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
      <GlassCard glow accentColor="#FFD166">
        <InputField
          label="Benutzername"
          value={username}
          onChangeText={(value) => setUsername(sanitizePortalUsernameInput(value))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <InputField
          label="Portal-Code (6-stellig)"
          value={code}
          onChangeText={(value) => setCode(normalizePortalCodeInput(value))}
          autoCapitalize="characters"
          maxLength={6}
        />
        <PremiumButton title="Einloggen" onPress={handleSubmit} loading={loading} fullWidth />
        <PremiumButton
          title="Hilfe anfordern"
          variant="secondary"
          onPress={() => openExternal(SUPPORT_LINKS.help)}
          fullWidth
        />
      </GlassCard>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: careSpacing.xs,
  },
});
