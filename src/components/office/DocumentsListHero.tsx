import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  PremiumButton,
  PremiumKpiCard,
  PremiumListHeroFrame,
  PremiumBadge,
  type DesktopListViewMode,
} from '@/components/ui';
import { useListHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import type { OfficeDocumentListKpi } from '@/lib/office/officeDocumentListStats';
import { ROLE_LABELS } from '@/data/constants';

import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type DocumentsListHeroProps = {
  kpis: OfficeDocumentListKpi[];
  roleKey: RoleKey;
  filteredCount: number;
  totalCount: number;
  canUpload: boolean;
  isReadOnly: boolean;
  onUploadPress?: () => void;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function DocumentsListHero({
  kpis,
  roleKey,
  filteredCount,
  totalCount,
  canUpload,
  isReadOnly,
  onUploadPress,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: DocumentsListHeroProps) {
  const accent = moduleColor('office');
  const heroText = useListHeroTextStyles();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={heroText.eyebrow}>OFFICE</Text>
          <Text style={heroText.title}>Dokumente</Text>
          <Text style={heroText.meta}>
            {filteredCount} von {totalCount} Einträgen
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={[styles.iconBadge, heroText.iconBorder, { backgroundColor: `${accent}18` }]}>
            <Text style={styles.iconText}>📄</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
      {!compact ? (
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <PremiumKpiCard
              key={kpi.id}
              label={kpi.label}
              value={String(kpi.value)}
              subValue={kpi.subValue}
              icon={kpi.icon}
              style={styles.kpiItem}
            />
          ))}
        </View>
      ) : null}
      {canUpload ? (
        <PremiumButton title="➕ Dokument hochladen" onPress={onUploadPress} />
      ) : null}
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

