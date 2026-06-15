import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor, type CareModuleKey } from '@/design/tokens/modules';
import { CareSuiteLogoMark } from './CareSuiteLogoMark';
import { CareSuiteWordmark } from './CareSuiteWordmark';

type CareSuiteBrandHeaderProps = {
  moduleKey?: CareModuleKey;
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
};

export function CareSuiteBrandHeader({
  moduleKey,
  title,
  subtitle,
  rightSlot,
  compact = false,
  style,
}: CareSuiteBrandHeaderProps) {
  const accent = moduleKey ? moduleColor(moduleKey) : careLightColors.orange;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.left}>
        {compact ? (
          <View style={styles.compactRow}>
            <CareSuiteLogoMark size="sm" />
            <View style={styles.compactText}>
              <Text style={styles.compactTitle}>{title ?? 'CareSuite+'}</Text>
              {subtitle ? <Text style={styles.compactSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
        ) : (
          <>
            <CareSuiteWordmark size="sm" />
            {title ? (
              <View style={[styles.moduleStripe, { borderLeftColor: accent }]}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
            ) : null}
          </>
        )}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.md,
    marginBottom: careSpacing.sm,
  },
  left: {
    flex: 1,
    gap: careSpacing.sm,
  },
  right: {
    flexShrink: 0,
  },
  moduleStripe: {
    borderLeftWidth: 3,
    paddingLeft: careSpacing.sm,
    gap: 2,
  },
  title: {
    ...careTypography.h3,
    color: careLightColors.navy,
  },
  subtitle: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  compactText: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
  },
  compactSubtitle: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
});
