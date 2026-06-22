import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildIntegrationDetailKpis } from '@/lib/integrations/integrationDetailStats';
import { isIntegrationsLiveReady } from '@/lib/integrations/integrationsModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { IntegrationProviderListItem } from '@/types/modules/integrations';
import {
  INTEGRATION_CATEGORY_LABELS,
  INTEGRATION_STATUS_LABELS,
} from '@/types/modules/integrations';
import { designTokens, spacing } from '@/theme';

type IntegrationDetailHeroProps = {
  integration: IntegrationProviderListItem;
  roleKey: RoleKey;
};

function statusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'error':
      return 'red' as const;
    case 'pending_setup':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function IntegrationDetailHero({ integration, roleKey }: IntegrationDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  const kpis = buildIntegrationDetailKpis(integration, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · INTEGRATION</Text>
          <Text style={styles.title}>{integration.name}</Text>
          <Text style={styles.meta}>
            {INTEGRATION_CATEGORY_LABELS[integration.category]} · {integration.providerKey}
          </Text>
          {integration.notes ? <Text style={styles.subtitle}>{integration.notes}</Text> : null}
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔌</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={INTEGRATION_STATUS_LABELS[integration.status]}
          variant={statusVariant(integration.status)}
          dot
        />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isIntegrationsLiveReady() ? (
          <PremiumBadge label="Live-Sync in Vorbereitung" variant="orange" dot />
        ) : null}
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
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

