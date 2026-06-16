import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DemoLoginHero } from '@/components/auth';
import { CareLightErrorState, PremiumButton } from '@/components/ui';
import { AuthPageShell } from '@/design/components';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { ROLE_LABELS } from '@/data/demo';
import { getDemoLoginLabel } from '@/lib/auth';
import { useAuth } from '@/lib/auth/context';
import type { RoleKey } from '@/types';

type DemoLoginScreenProps = {
  title: string;
  subtitle: string;
  roles: RoleKey[];
};

export function DemoLoginScreen({ title, subtitle, roles }: DemoLoginScreenProps) {
  const { signInDemo, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const handleLogin = async (roleKey: RoleKey) => {
    setError(null);
    setSuccess(false);
    try {
      await signInDemo(roleKey);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen.');
    }
  };

  return (
    <AuthPageShell title={title} subtitle={subtitle}>
      <DemoLoginHero title={title} subtitle={subtitle} roleCount={roles.length} />

      {error ? <CareLightErrorState message={error} onRetry={() => setError(null)} /> : null}
      {success ? (
        <Text style={[type.body, styles.success]} numberOfLines={2}>
          Anmeldung erfolgreich — Weiterleitung…
        </Text>
      ) : null}

      <View style={styles.roles}>
        {roles.map((roleKey) => (
          <PremiumButton
            key={roleKey}
            title={getDemoLoginLabel(roleKey)}
            onPress={() => handleLogin(roleKey)}
            loading={isLoading}
            fullWidth
          />
        ))}
      </View>

      <Text style={[type.caption, styles.roleHint]} numberOfLines={3}>
        Verfügbare Rollen: {roles.map((r) => ROLE_LABELS[r]).join(' · ')}
      </Text>
    </AuthPageShell>
  );
}

const styles = StyleSheet.create({
  roles: { gap: careSpacing.sm },
  roleHint: { textAlign: 'center', flexShrink: 1 },
  success: {
    color: galaxyPalette.success,
    textAlign: 'center',
    fontWeight: '600',
  },
});
