import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ModuleTile, PremiumBadge, PremiumButton, SectionPanel } from '@/components/ui';
import { MODULE_NAV_CONFIG } from '@/data/demo/navigation';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { useAuth } from '@/lib/auth/context';
import { ROLE_LABELS } from '@/data/demo';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { colors, spacing, typography } from '@/theme';

export function BusinessHubScreen() {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const { modules } = useModuleAccess();

  return (
    <ScreenShell
      title="Business-Bereich"
      subtitle={profile?.displayName ?? user?.displayName ?? 'Willkommen'}
      rightSlot={
        <PremiumButton title="Abmelden" variant="ghost" size="sm" onPress={() => signOut().then(() => router.replace('/' as never))} />
      }
    >
      <PremiumBadge
        label={profile?.roleKey ? ROLE_LABELS[profile.roleKey] : 'Keine Rolle'}
        variant="orange"
      />

      <SectionPanel title="Module öffnen" subtitle="Aktive Module sind direkt erreichbar">
        <View style={styles.grid}>
          {modules.map((module) => {
            const config = MODULE_NAV_CONFIG[module.productKey];
            return (
              <ModuleTile
                key={module.productKey}
                icon={config.icon}
                title={PRODUCT_LABELS[module.productKey]}
                description={config.description}
                accentColor={config.accentColor}
                isActive={module.isEffective}
                onPress={() => router.push(config.path as never)}
              />
            );
          })}
        </View>
      </SectionPanel>

      <PremiumButton
        title="Template Center"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/business/templates' as never)}
      />

      <PremiumButton
        title="Module verwalten"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/business/modules' as never)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
});
