import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import { careModuleTokens, type CareModuleKey } from '@/design/tokens/modules';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { GlassCard } from './GlassCard';
import { StatusBadge } from './StatusBadge';

type ModuleCardProps = {
  moduleKey: CareModuleKey;
  title: string;
  description?: string;
  selected?: boolean;
  locked?: boolean;
  statusKind?: 'active' | 'preparedOnly' | 'comingSoon';
  onPress?: () => void;
  trailing?: ReactNode;
};

/** Registration / module picker card — glass default, glow + checkmark when selected. */
export function ModuleCard({
  moduleKey,
  title,
  description,
  selected = false,
  locked = false,
  statusKind,
  onPress,
  trailing,
}: ModuleCardProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const token = careModuleTokens[moduleKey];
  const accent = token?.color ?? galaxyPalette.galaxyCyan;

  return (
    <GlassCard
      onPress={locked ? undefined : onPress}
      selected={selected || locked}
      accentColor={accent}
      glow={selected}
      style={locked ? styles.locked : undefined}
    >
      <View style={styles.row}>
        <CareSuiteIcon emoji={token?.icon ?? '📦'} accentColor={accent} size={44} />
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={[type.cardTitle, styles.title]} numberOfLines={2}>
              {title}
            </Text>
            {selected || locked ? (
              <Text style={styles.check} accessibilityLabel="Ausgewählt">
                ✓
              </Text>
            ) : null}
          </View>
          {description ? (
            <Text style={[type.caption, styles.desc]} numberOfLines={3}>
              {description}
            </Text>
          ) : null}
          {statusKind ? (
            <View style={styles.badges}>
              <StatusBadge kind={statusKind} />
            </View>
          ) : null}
        </View>
        {trailing}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: careSpacing.md,
    alignItems: 'flex-start',
    minWidth: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: careSpacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
    minWidth: 0,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  check: {
    color: galaxyPalette.careOrange,
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 0,
    lineHeight: 22,
  },
  desc: {
    flexShrink: 1,
    minWidth: 0,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: careSpacing.xs,
  },
  locked: {
    opacity: 0.95,
  },
});
