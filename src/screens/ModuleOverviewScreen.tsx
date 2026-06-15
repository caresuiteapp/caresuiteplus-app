import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useReducer } from 'react';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { BusinessModuleHubHero, ModuleCard } from '@/components/modules';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useAuth } from '@/lib/auth/context';
import { spacing } from '@/theme';

export function ModuleOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { modules, billing } = useModuleAccess();
  const [, refresh] = useReducer((x: number) => x + 1, 0);

  return (
    <CareLightPageShell title="Module verwalten" subtitle="CareSuite+ Free Platform — 0 €">
      <ScrollView contentContainerStyle={styles.scroll}>
        <BusinessModuleHubHero modules={modules} billing={billing} roleKey={roleKey} />

        <PremiumPreparedNotice compact />

        <SectionPanel
          title="Modul-Status"
          subtitle="CareSuite+ Office ist Basisverwaltung — alle Hauptmodule kostenlos aktivieren"
        >
          <View style={styles.list}>
            {modules.map((module) => (
              <ModuleCard key={module.productKey} module={module} onActivated={refresh} />
            ))}
          </View>
        </SectionPanel>

        <PremiumButton
          title="Office-Modulrechte"
          variant="secondary"
          onPress={() => router.push('/business/office/access/module-permissions' as never)}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  list: { gap: spacing.sm },
});
