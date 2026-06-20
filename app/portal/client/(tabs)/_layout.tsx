import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ClientPortalShell } from '@/components/portal/ClientPortalShell';

export default function ClientPortalTabsLayout() {
  return (
    <ClientPortalShell>
      <View style={styles.slot}>
        <Slot />
      </View>
    </ClientPortalShell>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
