import { useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumButton } from './PremiumButton';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { DashboardQuickAction } from '@/types/dashboard';

type CareLightQuickActionsMenuProps = {
  actions: DashboardQuickAction[];
  onAction: (action: DashboardQuickAction) => void;
  accentColor?: string;
  maxVisible?: number;
  moreLabel?: string;
  actionRef?: RefObject<View>;
  style?: ViewStyle;
};

export function CareLightQuickActionsMenu({
  actions,
  onAction,
  accentColor = careLightColors.orange,
  maxVisible = 2,
  moreLabel = 'Mehr Aktionen',
  actionRef,
  style,
}: CareLightQuickActionsMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleActions = actions.slice(0, maxVisible);
  const overflowActions = actions.slice(maxVisible);

  const handleOverflowPress = (action: DashboardQuickAction) => {
    setExpanded(false);
    onAction(action);
  };

  return (
    <View style={[styles.root, style]}>
      {visibleActions.map((action, index) => (
        <View
          key={action.id}
          ref={index === 0 ? actionRef : undefined}
          collapsable={false}
        >
          <PremiumButton
            title={`${action.icon} ${action.label}`}
            variant={action.variant === 'primary' ? 'primary' : 'secondary'}
            onPress={() => onAction(action)}
          />
        </View>
      ))}

      {overflowActions.length > 0 ? (
        <View style={styles.overflowWrap}>
          <PremiumButton
            title={`${expanded ? '▴' : '▾'} ${moreLabel}`}
            variant="secondary"
            onPress={() => setExpanded((open) => !open)}
            style={styles.moreButton}
          />
          {expanded ? (
            <View style={styles.menu}>
              {overflowActions.map((action) => (
                <Pressable
                  key={action.id}
                  onPress={() => handleOverflowPress(action)}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.menuIcon}>{action.icon}</Text>
                  <Text style={styles.menuLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.sm,
  },
  overflowWrap: {
    gap: careSpacing.xs,
  },
  moreButton: {
    width: '100%',
  },
  menu: {
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.md,
    borderWidth: 1,
    borderColor: careLightColors.borderStrong,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: careLightColors.border,
  },
  menuItemPressed: {
    backgroundColor: `${careLightColors.cyan}08`,
  },
  menuIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  menuLabel: {
    ...careTypography.bodyStrong,
    color: careLightColors.navy,
    flex: 1,
  },
});
