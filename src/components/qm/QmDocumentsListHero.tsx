import { StyleSheet, Text, View } from 'react-native';
import {
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
} from '@/components/ui';
import { useListHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { buildQmDocumentsListKpis } from '@/lib/qm/qmDocumentsListStats';
import { isQmDocumentsLiveReady, QM_DOCUMENTS_PREPARED_MESSAGE } from '@/lib/qm/qmModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { QmDocument } from '@/lib/qm/qm.types';
import { designTokens } from '@/theme';

type QmDocumentsListHeroProps = {
  documents: QmDocument[];
  roleKey: RoleKey;
};

export function QmDocumentsListHero({ documents, roleKey }: QmDocumentsListHeroProps) {
  const accent = moduleColor('qm');
  const heroText = useListHeroTextStyles();

  const kpis = buildQmDocumentsListKpis(documents, 'light');
  const isLive = isQmDocumentsLiveReady();

  return (
    <CareLightListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={heroText.eyebrow}>QUALITÄTSMANAGEMENT</Text>
          <Text style={heroText.title}>QM-Dokumente</Text>
          <Text style={heroText.meta}>
            {documents.length} Dokumente · Verfahren, Richtlinien und Formulare
          </Text>
        </View>
        <View style={[styles.iconBadge, heroText.iconBorder, { backgroundColor: `${accent}18` }]}>
          <Text style={styles.iconText}>📄</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isLive ? (
          <PremiumBadge label="Live Supabase" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
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
      {!isLive ? <Text style={heroText.meta}>{QM_DOCUMENTS_PREPARED_MESSAGE}</Text> : null}
    </CareLightListHeroFrame>
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

