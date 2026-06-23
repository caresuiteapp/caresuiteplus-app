import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumKpiCard, SectionPanel } from '@/components/ui';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { buildModuleHubKpis } from '@/lib/modules/moduleHubStats';
import { useThemeMode } from '@/design/ThemeModeProvider';

import type { BillingPreview } from '@/lib/modules/moduleEntitlementService';
import type { EffectiveModuleAccess, RoleKey } from '@/types';
import { spacing } from '@/theme';

type BusinessModuleHubHeroProps = {
  modules: EffectiveModuleAccess[];
  billing: BillingPreview;
  roleKey?: RoleKey;
};

export function BusinessModuleHubHero({ modules, billing }: BusinessModuleHubHeroProps) {
  const { mode } = useThemeMode();
  const content = useAdaptiveContentStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        intro: {
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        introText: {
          ...content.body,
          color: content.secondary.color,
        },
        kpiRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        kpiItem: {
          flex: 1,
          minWidth: 140,
        },
      }),
    [content.body, content.secondary.color],
  );

  const kpis = buildModuleHubKpis(modules, billing, mode);

  return (
    <SectionPanel title="Übersicht" subtitle="Status Ihrer Mandantenmodule" surface="open">
      <View style={styles.intro}>
        <Text style={styles.introText}>
          Aktuell sind die Hauptmodule für diesen Mandanten ohne Checkout aktivierbar.
        </Text>
        <Text style={styles.introText}>
          Abrechnungs- und Premiumfunktionen sind vorbereitet, aber noch nicht aktiv.
        </Text>
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
            variant="light"
          />
        ))}
      </View>
    </SectionPanel>
  );
}
