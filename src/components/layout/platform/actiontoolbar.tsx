import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';

export type ActionToolbarItem = {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type ActionToolbarProps = {
  actions: ActionToolbarItem[];
  leftSlot?: ReactNode;
  accentColor?: string;
  style?: ViewStyle;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : undefined;

export function ActionToolbar({ actions, leftSlot, accentColor, style }: ActionToolbarProps) {
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  return (
    <View style={[styles.root, style]}>
      {leftSlot ? <View style={styles.left}>{leftSlot}</View> : null}
      <View style={styles.actions}>
        {actions.map((action) => {
          const isPrimary = action.variant === 'primary' || (!action.variant && actions[0]?.key === action.key);
          const isGhost = action.variant === 'ghost';

          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={[
                styles.btn,
                isPrimary && styles.btnPrimary,
                isGhost && styles.btnGhost,
                webCursor,
              ]}
              accessibilityRole="button"
            >
              {action.icon ? <Text style={styles.btnIcon}>{action.icon}</Text> : null}
              <Text
                style={[
                  styles.btnLabel,
                  isPrimary && styles.btnLabelPrimary,
                  isGhost && styles.btnLabelGhost,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  accent: string,
) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    left: { flex: 1, minWidth: 0 },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'flex-end',
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    },
    btnPrimary: {
      backgroundColor: withAlpha(accent, 0.9),
      borderColor: withAlpha(accent, 0.9),
    },
    btnGhost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    btnIcon: { fontSize: 14 },
    btnLabel: {
      ...typography.button,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    btnLabelPrimary: { color: '#FFFFFF' },
    btnLabelGhost: { color: colors.textMuted },
  });
}
