import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';

/** Shell lives in app/portal/employee/_layout.tsx — tabs render content only. */
export default function EmployeePortalTabsLayout() {
  return (
    <View style={styles.slot}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent', minHeight: 0 },
});
