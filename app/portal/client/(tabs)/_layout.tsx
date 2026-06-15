import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { moduleColor } from '@/design/tokens/modules';

export default function ClientPortalTabsLayout() {
  return (
    <ShellLayout area="portal_client" accentColor={moduleColor('office')} showModuleSwitcher={false}>
      <View style={styles.slot}>
        <Slot />
      </View>
    </ShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
