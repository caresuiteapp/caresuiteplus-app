import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

export type VisitBottomBarAction = {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
  active?: boolean;
};

type EmployeePortalVisitBottomBarProps = {
  actions: VisitBottomBarAction[];
};

export function EmployeePortalVisitBottomBar({ actions }: EmployeePortalVisitBottomBarProps) {
  const text = useAuroraAdaptiveText();
  const insets = useSafeAreaInsets();
  const visibleActions = actions.slice(0, 4);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: auroraGlass.elevated,
          borderTopWidth: 1,
          borderTopColor: auroraGlass.innerBorder,
          ...Platform.select({
            web: { zIndex: 30 },
            default: {},
          }),
        },
        action: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xs,
          borderRadius: 10,
          gap: 2,
        },
        actionActive: {
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
        },
        icon: { fontSize: 16 },
        label: { ...typography.caption, color: text.secondary, textAlign: 'center', fontSize: 11 },
        labelActive: { color: text.primary, fontWeight: '600' },
      }),
    [insets.bottom, text],
  );

  return (
    <View style={styles.root}>
      {visibleActions.map((action) => (
        <Pressable
          key={action.key}
          style={[styles.action, action.active ? styles.actionActive : null]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          {action.icon ? <Text style={styles.icon}>{action.icon}</Text> : null}
          <Text style={[styles.label, action.active ? styles.labelActive : null]} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
