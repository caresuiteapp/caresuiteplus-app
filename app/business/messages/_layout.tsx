import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function MessagesLayout() {
  return (
    <ShellLayout area="business" accentColor="#67E8F9">
      <View style={styles.slot}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: routeLayoutContentStyle,
            animation: 'slide_from_right',
          }}
        />
      </View>
    </ShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent' },
});
