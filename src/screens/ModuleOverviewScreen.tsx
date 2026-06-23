import { useMemo, useReducer, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { BusinessModuleHubHero, ModuleCard } from '@/components/modules';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useAuth } from '@/lib/auth/context';
import { resolveModuleActivityStatus } from '@/lib/modules/moduleManagementLabels';
import { spacing } from '@/theme';

type ModuleSectionFocus = 'all' | 'active' | 'available' | 'extensions';

export function ModuleOverviewScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const [revision, refresh] = useReducer((x: number) => x + 1, 0);
  const { modules, billing, tenantId } = useModuleAccess(revision);
  const [focus, setFocus] = useState<ModuleSectionFocus>('all');

  const filteredModules = useMemo(() => {
    if (focus === 'active') {
      return modules.filter((module) => module.isEffective);
    }
    if (focus === 'available') {
      return modules.filter(
        (module) => !module.isEffective && resolveModuleActivityStatus(module) === 'Verfügbar',
      );
    }
    return modules;
  }, [focus, modules]);

  return (
    <ScreenShell
      title="Module & Lizenzen"
      subtitle="Module verwalten, freischalten und Mandantenfunktionen steuern"
      scroll={false}
      showBack={false}
      rightSlot={
        <View style={styles.headerActions}>
          <PremiumButton
            title="Verfügbare Module"
            size="sm"
            variant={focus === 'available' ? 'primary' : 'secondary'}
            onPress={() => setFocus('available')}
          />
          <PremiumButton
            title="Aktive Module"
            size="sm"
            variant={focus === 'active' ? 'primary' : 'ghost'}
            onPress={() => setFocus('active')}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.toolbar}>
          <PremiumButton
            title="Erweiterungen ansehen"
            variant="secondary"
            size="sm"
            onPress={() => setFocus('extensions')}
          />
          <PremiumButton
            title="Hilfe zu Modulen"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/business/connect' as never)}
          />
        </View>

        <BusinessModuleHubHero modules={modules} billing={billing} roleKey={roleKey} />

        <PremiumPreparedNotice compact variant="extensions" />

        {focus !== 'extensions' ? (
          <SectionPanel
            title="Aktive und verfügbare Module"
            subtitle="Hauptmodule für Verwaltung, Assist, Pflege, Beratung, Akademie und stationäre Angebote"
          >
            <View style={styles.list}>
              {filteredModules.map((module) => (
                <ModuleCard
                  key={module.productKey}
                  module={module}
                  tenantId={tenantId}
                  roleKey={roleKey}
                  onChanged={refresh}
                />
              ))}
            </View>
          </SectionPanel>
        ) : (
          <PremiumButton
            title="Zurück zu allen Modulen"
            variant="secondary"
            onPress={() => setFocus('all')}
          />
        )}

        {focus !== 'all' && focus !== 'extensions' ? (
          <PremiumButton title="Alle Module anzeigen" variant="ghost" onPress={() => setFocus('all')} />
        ) : null}

        <PremiumButton
          title="Modulzuordnungen & Rechte"
          variant="secondary"
          onPress={() => router.push('/business/office/access/module-permissions' as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  headerActions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  toolbar: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  list: { gap: spacing.sm },
});
