import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useReducer } from 'react';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { BusinessModuleHubHero, ModuleCard } from '@/components/modules';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useAuth } from '@/lib/auth/context';
import { isModuleScopeVisible } from '@/lib/modules/moduleVisibilityService';
import { spacing } from '@/theme';

export function ModuleOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { modules, billing, tenantId } = useModuleAccess();
  const [, refresh] = useReducer((x: number) => x + 1, 0);

  const visibleModules = useMemo(
    () =>
      modules.filter((module) =>
        isModuleScopeVisible(module.productKey, { tenantId, roleKey }),
      ),
    [modules, tenantId, roleKey],
  );

  return (
    <CareLightPageShell title="Module verwalten" subtitle="CareSuite+ Plattform">
      <ScrollView contentContainerStyle={styles.scroll}>
        <BusinessModuleHubHero modules={visibleModules} billing={billing} roleKey={roleKey} />

        <PremiumPreparedNotice compact />

        <SectionPanel
          title="Modul-Status"
          subtitle="CareSuite+ Office ist Basisverwaltung — Hauptmodule aktivieren"
        >
          <View style={styles.list}>
            {visibleModules.map((module) => (
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
