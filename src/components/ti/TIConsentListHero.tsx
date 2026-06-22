import { StyleSheet, Text, View } from 'react-native';
import {
  PremiumKpiCard,
  PremiumListHeroFrame,
  PremiumBadge,
} from '@/components/ui';
import { useListHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { TIConnectionStatusBadge } from './TIConnectionStatusBadge';
import { ROLE_LABELS } from '@/data/constants';
import { buildTIConsentListKpis } from '@/lib/ti/tiConsentListStats';
import { isTILiveReady, TI_PREPARED_MESSAGE } from '@/lib/ti/tiModuleConfig';

import type { TIConsent } from '@/types/modules/ti';
import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type TIConsentListHeroProps = {
  consents: TIConsent[];
  roleKey: RoleKey;
};

export function TIConsentListHero({ consents, roleKey }: TIConsentListHeroProps) {
  const accent = careLightColors.cyan;
  const heroText = useListHeroTextStyles();

  const kpis = buildTIConsentListKpis(consents, 'light');

  return (
    <PremiumListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={heroText.eyebrow}>BUSINESS · TELEMATIK</Text>
          <Text style={heroText.title}>TI-Einwilligungen</Text>
          <Text style={heroText.meta}>DSGVO-konforme Verarbeitung und Consent-Verwaltung</Text>
        </View>
        <View style={[styles.iconBadge, heroText.iconBorder, { backgroundColor: `${accent}18` }]}>
          <Text style={styles.iconText}>📜</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <TIConnectionStatusBadge status="not_configured" />
        {!isTILiveReady() ? (
          <PremiumBadge label="TI in Vorbereitung" variant="orange" dot />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
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
      {!isTILiveReady() ? <Text style={heroText.meta}>{TI_PREPARED_MESSAGE}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
});

