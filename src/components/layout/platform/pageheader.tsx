import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, typography } from '@/theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  rightSlot?: ReactNode;
  style?: ViewStyle;
};

export function PageHeader({ title, subtitle, badge, rightSlot, style }: PageHeaderProps) {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.left}>
        {badge ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badge}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useLegacyTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    left: { flex: 1, gap: spacing.xs },
    right: { flexShrink: 0 },
    badgeWrap: { alignSelf: 'flex-start' },
    badge: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
  });
}
