import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { HealthOSNavGroup, HealthOSNavItem } from '../navigation/types';
import { resolveNavVisibility } from '../navigation/resolveHealthOSNavigation';
import { healthosShellLayoutRules } from './healthosShellLayoutRules';

type Props = {
  groups: HealthOSNavGroup[];
  accentColor?: string;
  collapsed?: boolean;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function NavRow({
  item,
  active,
  accentColor,
  collapsed,
}: {
  item: HealthOSNavItem;
  active: boolean;
  accentColor: string;
  collapsed: boolean;
}) {
  const router = useRouter();
  const visibility = resolveNavVisibility(item);
  const disabled = visibility === 'disabled' || !item.href;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          paddingVertical: careSpacing.sm,
          paddingHorizontal: careSpacing.md,
          minHeight: healthosShellLayoutRules.desktop.sidebar.minTouchTarget,
          borderRadius: 8,
          opacity: disabled ? 0.45 : 1,
          backgroundColor: active ? `${accentColor}18` : 'transparent',
        },
        icon: { fontSize: 18 },
        label: {
          ...careTypography.label,
          fontWeight: active ? '700' : '500',
          flex: 1,
        },
      }),
    [active, accentColor, disabled],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={() => {
        if (item.href) router.push(item.href as never);
      }}
      style={styles.row}
      testID={`healthos-sidebar-item-${item.key}`}
    >
      <Text style={styles.icon}>{item.icon}</Text>
      {!collapsed ? <Text style={styles.label}>{item.label}</Text> : null}
    </Pressable>
  );
}

export function HealthOSDesktopSidebar({
  groups,
  accentColor = '#007AFF',
  collapsed = false,
  header,
  style,
  testID = 'healthos-desktop-sidebar',
}: Props) {
  const pathname = usePathname();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, paddingVertical: careSpacing.md },
        groupTitle: {
          ...careTypography.caption,
          fontWeight: '700',
          opacity: 0.6,
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.xs,
        },
      }),
    [],
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      {header}
      {groups.map((group) => (
        <View key={group.title}>
          {!collapsed ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
          {group.items
            .filter((item) => {
              const v = resolveNavVisibility(item);
              return v === 'visible' || v === 'disabled';
            })
            .map((item) => {
              const active = Boolean(item.href && pathname.startsWith(item.href.split('?')[0]));
              return (
                <NavRow
                  key={item.key}
                  item={item}
                  active={active}
                  accentColor={accentColor}
                  collapsed={collapsed}
                />
              );
            })}
        </View>
      ))}
    </View>
  );
}
