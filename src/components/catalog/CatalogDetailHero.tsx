import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildCatalogDetailKpis } from '@/lib/catalog/catalogDetailStats';
import { CATALOG_TYPE_LABELS } from '@/types/modules/catalog';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { isDemoMode } from '@/lib/supabase/config';
import type { CatalogDetail } from '@/types/modules/catalog';
import { designTokens, spacing } from '@/theme';

type CatalogDetailHeroProps = {
  catalog: CatalogDetail;
  itemCount: number;
};

export function CatalogDetailHero({ catalog, itemCount }: CatalogDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.orange,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,152,0,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  desc: { ...typography.body, color: colors.textSecondary },
}),
    [colors, typography, gradients],
  );


  const kpis = buildCatalogDetailKpis(catalog, itemCount, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · KATALOG</Text>
          <Text style={styles.title}>{catalog.name}</Text>
          <Text style={styles.meta}>
            {CATALOG_TYPE_LABELS[catalog.catalogType]} · {WORKFLOW_STATUS_LABELS[catalog.status]}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📋</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={CATALOG_TYPE_LABELS[catalog.catalogType]} variant="orange" dot />
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[catalog.status]} variant="muted" />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
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
          />
        ))}
      </View>
      {catalog.description ? <Text style={styles.desc}>{catalog.description}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

