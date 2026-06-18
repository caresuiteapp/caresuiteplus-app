import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DemoLoginHero } from '@/components/auth';
import { CareLightPageShell } from '@/components/layout';
import { CareLightButton, CareLightErrorState } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { getDemoLoginLabel } from '@/lib/auth';
import { useAuth } from '@/lib/auth/context';
import { getPostLoginRedirect } from '@/lib/navigation';
import type { RoleKey } from '@/types';

type DemoLoginScreenProps = {
  title: string;
  subtitle: string;
  roles: RoleKey[];
};

export function DemoLoginScreen({ title, subtitle, roles }: DemoLoginScreenProps) {
  const router = useRouter();
  const { signInDemo, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (roleKey: RoleKey) => {
    setError(null);
    setSuccess(false);
    try {
      await signInDemo(roleKey);
      setSuccess(true);
      const target = getPostLoginRedirect(roleKey);
      setTimeout(() => router.replace(target), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
  };

  return (
    <CareLightPageShell title={title} subtitle={subtitle} scroll>
      <DemoLoginHero title={title} subtitle={subtitle} roleCount={roles.length} />

      {error ? <CareLightErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? (
        <Text style={styles.success}>Anmeldung erfolgreich — Weiterleitung…</Text>
      ) : null}

      <View style={styles.roles}>
        {roles.map((roleKey) => (
          <CareLightButton
            key={roleKey}
            title={getDemoLoginLabel(roleKey)}
            onPress={() => handleLogin(roleKey)}
            loading={isLoading}
            style={styles.roleButton}
          />
        ))}
      </View>

      <Text style={styles.roleHint}>
        Verfügbare Rollen: {roles.map((r) => ROLE_LABELS[r]).join(' · ')}
      </Text>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  roles: { gap: careSpacing.sm },
  roleButton: { width: '100%' },
  roleHint: { ...careTypography.caption, color: careLightColors.muted, textAlign: 'center' },
  success: {
    ...careTypography.bodyStrong,
    color: careLightColors.green,
    textAlign: 'center',
  },
});
