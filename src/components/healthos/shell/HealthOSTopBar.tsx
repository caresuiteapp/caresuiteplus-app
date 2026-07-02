import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { healthosShellLayoutRules } from './healthosShellLayoutRules';

type Props = {
  title?: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Presentational top bar slot — no auth or tenant fetching. */
export function HealthOSTopBar({
  title,
  subtitle,
  leading,
  trailing,
  compact = false,
  style,
  testID = 'healthos-top-bar',
}: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: careSpacing.md,
          paddingVertical: compact ? careSpacing.sm : careSpacing.md,
          minHeight: compact ? 48 : 56,
          gap: careSpacing.sm,
          zIndex: healthosShellLayoutRules.zIndex.topBar,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: 'rgba(0,0,0,0.08)',
        },
        titles: { flex: 1, minWidth: 0 },
        title: { ...careTypography.h3, fontWeight: '700' },
        subtitle: { ...careTypography.caption, opacity: 0.7, marginTop: 2 },
        slot: { flexShrink: 0 },
      }),
    [compact],
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      {leading ? <View style={styles.slot}>{leading}</View> : null}
      <View style={styles.titles}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle && !compact ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.slot}>{trailing}</View> : null}
    </View>
  );
}
