import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  employeePortalExecutionShadow,
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { spacing, typography } from '@/theme';

export type VisitBottomBarAction = {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
};

type EmployeePortalVisitBottomBarProps = {
  actions: VisitBottomBarAction[];
};

export function EmployeePortalVisitBottomBar({ actions }: EmployeePortalVisitBottomBarProps) {
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
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          backgroundColor: employeePortalExecutionSurface.actionBarBackground,
          borderTopWidth: 1,
          borderTopColor: employeePortalExecutionSurface.actionBarBorder,
          ...employeePortalExecutionShadow,
          ...Platform.select({
            web: { zIndex: 30 },
            default: {},
          }),
        },
        action: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 64, paddingVertical: spacing.xs, borderRadius: 14,
          gap: 2,
        },
        actionActive: {
          backgroundColor: employeePortalExecutionSurface.actionBarActive,
        },
        label: { ...typography.caption, color: employeePortalExecutionText.onStrongMuted, textAlign: 'center', fontSize: 11 },
        labelActive: { color: employeePortalExecutionText.onStrong, fontWeight: '800' },
      }),
    [insets.bottom],
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
          {action.icon ? (
            <Ionicons
              name={action.icon}
              size={21}
              color={action.active ? '#69B5FF' : 'rgba(248,251,255,0.76)'}
            />
          ) : null}
          <Text style={[styles.label, action.active ? styles.labelActive : null]} numberOfLines={2}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
