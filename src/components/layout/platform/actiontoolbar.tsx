import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, typography } from '@/theme';

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

const ACTION_GAP = 12;
const PRIMARY_ROW_MAX = 2;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : undefined;

export function ActionToolbar({ actions, leftSlot, accentColor, style }: ActionToolbarProps) {
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  const primaryActions = actions.slice(0, PRIMARY_ROW_MAX);
  const secondaryActions = actions.slice(PRIMARY_ROW_MAX);

  const renderAction = (action: ActionToolbarItem, row: 'primary' | 'secondary') => {
    const isPrimary = row === 'primary';
    const isGhost = row === 'secondary' && action.variant === 'ghost';

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
  };

  return (
    <View style={[styles.root, style]}>
      {leftSlot ? <View style={styles.left}>{leftSlot}</View> : null}
      <View style={styles.actionsColumn}>
        {primaryActions.length > 0 ? (
          <View style={styles.primaryRow}>
            {primaryActions.map((action) => renderAction(action, 'primary'))}
          </View>
        ) : null}
        {secondaryActions.length > 0 ? (
          <View style={styles.secondaryRow}>
            {secondaryActions.map((action) => renderAction(action, 'secondary'))}
          </View>
        ) : null}
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
      flexDirection: 'column',
      gap: ACTION_GAP,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    left: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    actionsColumn: {
      flexDirection: 'column',
      gap: ACTION_GAP,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    primaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ACTION_GAP,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    secondaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ACTION_GAP,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      maxWidth: '100%',
      minWidth: 0,
      flexShrink: 1,
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
      flexShrink: 1,
    },
    btnLabelPrimary: { color: '#FFFFFF' },
    btnLabelGhost: { color: colors.textMuted },
  });
}
