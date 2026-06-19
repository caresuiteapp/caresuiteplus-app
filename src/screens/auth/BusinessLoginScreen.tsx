import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
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
import type { InternalRoleKey } from '@/lib/auth/auth.types';
import { resolveLoginDashboardRoute } from '@/lib/auth/authNavigation';
import { loginBusinessUser } from '@/lib/auth/businessAuthService';
import { useAuth } from '@/lib/auth/context';
import { usePostLoginNavigation } from '@/lib/auth/usePostLoginNavigation';
import { mapCanonicalRoleToRoleKey } from '@/lib/permissions/workspaceRoles';
import { isDemoMode } from '@/lib/supabase/config';
import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import type { RoleKey } from '@/types';

function resolveDemoRoleKey(internalRoleKey: InternalRoleKey): RoleKey {
  return mapCanonicalRoleToRoleKey(internalRoleKey as CanonicalWorkspaceRoleKey);
}

export function BusinessLoginScreen() {
  const router = useRouter();
  const { signInDemo, signInWithSupabaseSession } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pendingDashboardRoute, setPendingDashboardRoute] = useState<Href | null>(null);

  usePostLoginNavigation({
    pendingRoute: pendingDashboardRoute,
    onNavigate: () => {
      setPendingDashboardRoute(null);
      setSuccess(true);
    },
    onClearPending: () => setPendingDashboardRoute(null),
  });

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    setPendingDashboardRoute(null);
    setLoading(true);
    const result = await loginBusinessUser(identifier, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    try {
      if (result.data.tenantUser && isDemoMode()) {
        await signInDemo(resolveDemoRoleKey(result.data.tenantUser.roleKey));
      } else if (result.data.supabaseSession) {
        await signInWithSupabaseSession(result.data.supabaseSession);
      } else {
        setError(
          'Anmeldung konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Zugangsdaten oder kontaktieren Sie den Support.',
        );
        return;
      }

      setPendingDashboardRoute(resolveLoginDashboardRoute('business'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
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
