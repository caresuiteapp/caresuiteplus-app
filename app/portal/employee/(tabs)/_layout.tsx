import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { EmployeePortalShell } from '@/components/portal/EmployeePortalShell';

export default function EmployeePortalTabsLayout() {
  return (
    <EmployeePortalShell>
      <View style={styles.slot}>
        <Slot />
      </View>
    </EmployeePortalShell>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
