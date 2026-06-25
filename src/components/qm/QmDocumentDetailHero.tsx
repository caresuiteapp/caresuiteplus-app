import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { buildQmDocumentDetailKpis } from '@/lib/qm/qmDocumentDetailStats';
import { isQmDocumentsLiveReady } from '@/lib/qm/qmModuleConfig';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import type { QmDocument, QmDocumentVersion } from '@/lib/qm';
import { designTokens, spacing } from '@/theme';
import { QmStatusBadge } from './QmStatusBadge';

type QmDocumentDetailHeroProps = {
  document: QmDocument;
  currentVersion?: QmDocumentVersion;
  versionCount: number;
  confirmationCount: number;
  roleKey: RoleKey;
  isReadOnly: boolean;
};

export function QmDocumentDetailHero({
  document,
  currentVersion,
  versionCount,
  confirmationCount,
  roleKey,
  isReadOnly,
}: QmDocumentDetailHeroProps) {
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


  const kpis = buildQmDocumentDetailKpis(document, currentVersion, versionCount, confirmationCount, mode);
  const isLive = isQmDocumentsLiveReady();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.meta}>
            {document.documentNumber}
            {currentVersion ? ` · v${currentVersion.versionNumber}` : ''}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📄</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <QmStatusBadge kind="document" status={document.status} />
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isLive ? (
          <PremiumBadge label="Live Supabase" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
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

