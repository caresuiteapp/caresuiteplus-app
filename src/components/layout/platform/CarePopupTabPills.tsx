import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  resolvePopupShellTabRowStyle,
  resolvePopupShellTabStyle,
  resolvePopupShellTabTextStyle,
  type PopupShellColorMode,
} from '@/design/tokens/popupShell';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';

export type CarePopupTab<T extends string = string> = {
  key: T;
  label: string;
};

export type CarePopupTabPillsProps<T extends string = string> = {
  tabs: readonly CarePopupTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  style?: StyleProp<ViewStyle>;
  colorMode?: PopupShellColorMode;
};

/** Pill filter tabs for CarePopupShell — inactive gray, active purple border + text. */
export function CarePopupTabPills<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  style,
  colorMode,
}: CarePopupTabPillsProps<T>) {
  const { isDark } = useCareLightPalette();
  const mode = colorMode ?? (isDark ? 'dark' : 'light');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: resolvePopupShellTabRowStyle(),
      }),
    [],
  );

  return (
    <View style={[styles.row, style]}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={resolvePopupShellTabStyle(active, mode)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={resolvePopupShellTabTextStyle(active, mode)}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
