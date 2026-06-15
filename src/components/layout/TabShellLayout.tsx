import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { colors } from '@/theme';

type TabShellLayoutProps = {
  area: Parameters<typeof ResponsiveLayout>[0]['area'];
  accentColor?: string;
};

/** Shared tab-area layout with responsive shell selection. */
export function TabShellLayout({ area, accentColor }: TabShellLayoutProps) {
  return (
    <ResponsiveLayout area={area} accentColor={accentColor}>
      <View style={styles.slot}>
        <Slot />
      </View>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
