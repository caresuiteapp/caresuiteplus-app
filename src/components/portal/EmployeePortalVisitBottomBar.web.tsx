import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

export type VisitBottomBarAction = { key: string; label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean };

/** A real layout row: its measured height comes out of the scroll area, never covers it. */
export function EmployeePortalVisitBottomBar({ actions, children }: { actions: VisitBottomBarAction[]; children?: ReactNode }) {
  return (
    <View style={styles.bar} accessibilityLabel="Aktionen für diesen Einsatz" testID="employee-visit-action-bar">
      <View style={styles.actions}>
        {actions.map(action => (
          <Pressable key={action.key} onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{ selected: Boolean(action.active) }} style={({ pressed }) => [styles.action, action.active && styles.active, pressed && styles.pressed]}>
            {action.icon ? <Ionicons name={action.icon} size={20} color={action.active ? '#056CE8' : '#365672'} /> : null}
            <Text style={[styles.label, action.active && styles.activeLabel]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexShrink: 0, flexDirection: 'row', alignItems: 'stretch', gap: 4, padding: 6, paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))' as unknown as number, borderTopWidth: 1, borderColor: '#C7DBEF', backgroundColor: '#F7FBFF' },
  actions: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  action: { flex: 1, minWidth: 56, minHeight: 48, paddingVertical: 6, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 3 },
  active: { backgroundColor: '#E2EFFF' },
  label: { fontSize: font(13), lineHeight: font(17), color: '#365672', textAlign: 'center', fontWeight: '600', flexShrink: 1 },
  activeLabel: { color: '#075DC7', fontWeight: '800' },
  pressed: { backgroundColor: '#E2EFFF' },
});
