import { StyleSheet, Text, View } from 'react-native';
import {
  CareLightKpiCard,
  CareLightListHeroFrame,
  DesktopListViewToggle,
  PremiumBadge,
  type DesktopListViewMode,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import type { MedicationListItem } from '@/data/demo/medications';
import { buildMedicationListKpis } from '@/lib/pflege/medicationListStats';
import {
  isMedicationEmpReady,
  MEDICATION_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type MedicationListHeroProps = {
  items: MedicationListItem[];
  roleKey: RoleKey;
  isReadOnly: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function MedicationListHero({
  items,
  roleKey,
  isReadOnly,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: MedicationListHeroProps) {
  const accent = moduleColor('pflege');

  const kpis = buildMedicationListKpis(items, 'light');

  return (
    <CareLightListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PFLEGE · MEDIKATION</Text>
          <Text style={styles.title}>Medikationsplan</Text>
          <Text style={styles.meta}>
            {items.length} Verordnungen
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>
            Verordnungen, Dosierungen und Einnahmezeiten — demo-funktional.
          </Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: `${accent}18` }]}>
          <Text style={styles.iconText}>💊</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isMedicationEmpReady() ? (
          <PremiumBadge label="eMP extern" variant="muted" />
        ) : null}
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
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
    </CareLightListHeroFrame>
  );
}

export { MEDICATION_PREPARED_MESSAGE };

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
  subtitle: { ...careTypography.caption, color: careLightColors.muted, marginTop: careSpacing.xs },
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

