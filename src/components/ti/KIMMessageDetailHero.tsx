import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { KIMMessageStatusBadge } from './KIMMessageStatusBadge';
import { buildKimMessageDetailKpis } from '@/lib/ti/kimMessageDetailStats';
import { isTILiveReady } from '@/lib/ti/tiModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { KIMMessageDetail } from '@/types/modules/ti';
import { designTokens, spacing } from '@/theme';

type KIMMessageDetailHeroProps = {
  message: KIMMessageDetail;
  roleKey: RoleKey;
};

export function KIMMessageDetailHero({ message, roleKey }: KIMMessageDetailHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
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
  eyebrow: heroText.eyebrow,
  title: heroText.title,
  meta: heroText.meta,
  subtitle: heroText.subtitle,
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


  const kpis = buildKimMessageDetailKpis(message, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{message.subject}</Text>
          <Text style={styles.meta}>
            Von {message.senderName ?? message.sender}
          </Text>
          <Text style={styles.subtitle}>
            {message.isMedical ? 'Medizinische Nachricht — geschützte Verarbeitung' : message.preview}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>✉️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <KIMMessageStatusBadge status={message.status} />
        {message.isMedical ? <PremiumBadge label="Medizinisch" variant="orange" dot /> : null}
        {message.hasAttachments ? <PremiumBadge label="Mit Anhängen" variant="cyan" /> : null}
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isTILiveReady() ? <PremiumBadge label="TI in Vorbereitung" variant="orange" dot /> : null}
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

