import { StyleSheet, Text, View } from 'react-native';
import {
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { TIConnectionStatusBadge } from './TIConnectionStatusBadge';
import { ROLE_LABELS } from '@/data/demo';
import { buildKIMMailboxListKpis } from '@/lib/ti/kimMailboxStats';
import { isTILiveReady, TI_PREPARED_MESSAGE } from '@/lib/ti/tiModuleConfig';
import { isDemoMode } from '@/lib/supabase/config';
import type { KIMMessageListItem, TIConnectionStatus } from '@/types/modules/ti';
import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type KIMMailboxListHeroProps = {
  items: KIMMessageListItem[];
  totalCount: number;
  roleKey: RoleKey;
  connectionStatus?: TIConnectionStatus;
  syncLabel?: string;
};

export function KIMMailboxListHero({
  items,
  totalCount,
  roleKey,
  connectionStatus = 'not_configured',
  syncLabel,
}: KIMMailboxListHeroProps) {
  const accent = careLightColors.cyan;

  const kpis = buildKIMMailboxListKpis(items, totalCount, 'light');

  return (
    <CareLightListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · TELEMATIK</Text>
          <Text style={styles.title}>KIM-Postfach</Text>
          <Text style={styles.meta}>
            {syncLabel ?? 'Kommunikation im Medizinwesen — Demo-Postfach bis Live-Connector.'}
          </Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: `${accent}18` }]}>
          <Text style={styles.iconText}>📨</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <TIConnectionStatusBadge status={connectionStatus} />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isTILiveReady() ? (
          <PremiumBadge label="TI in Vorbereitung" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <CareLightKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>
      {!isTILiveReady() ? <Text style={styles.preparedHint}>{TI_PREPARED_MESSAGE}</Text> : null}
    </CareLightListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
    fontWeight: '700',
  },
  title: { ...careTypography.h2, color: careLightColors.navy },
  meta: { ...careTypography.caption, color: careLightColors.muted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: careLightColors.border,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...careTypography.caption, color: careLightColors.muted },
});

