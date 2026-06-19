import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { PortalShellLayout } from '@/components/layout/portal';

export default function ClientPortalTabsLayout() {
  return (
    <PortalShellLayout>
      <View style={styles.slot}>
        <Slot />
      </View>
    </PortalShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
