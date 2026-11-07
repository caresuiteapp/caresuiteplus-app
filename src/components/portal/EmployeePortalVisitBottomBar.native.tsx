// Generated native presentation from src/components/portal/EmployeePortalVisitBottomBar.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePortalViewport } from '@/lib/portal/portalViewportContext';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { employeePortalWorkspace as c } from './employee/employeePortalDesign';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
export type VisitBottomBarAction = {
    key: string;
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    active?: boolean;
};
/** A real layout row: its measured height comes out of the scroll area, never covers it. */
export function EmployeePortalVisitBottomBar({ actions, children }: {
    actions: VisitBottomBarAction[];
    children?: ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const { footerInFlow } = usePortalViewport();
    return (<View style={[styles.bar, { paddingBottom: Math.max(6, footerInFlow ? 0 : insets.bottom) }]} accessibilityLabel="Aktionen für diesen Einsatz" testID="employee-visit-action-bar">
      <View style={styles.actions}>
        {actions.map(action => (<Pressable key={action.key} onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{ selected: Boolean(action.active) }} style={({ pressed }) => [styles.action, action.active && styles.active, pressed && styles.pressed]}>
            {action.icon ? <Ionicons name={action.icon} size={20} color={action.active ? c.accent : c.secondary}/> : null}
            <Text style={[styles.label, action.active && styles.activeLabel]}>{action.label}</Text>
          </Pressable>))}
      </View>
      {children}
    </View>);
}
const styles = StyleSheet.create({
    bar: { flexShrink: 0, flexDirection: 'row', alignItems: 'stretch', gap: 4, padding: 6, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    actions: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    action: { flex: 1, minWidth: 56, minHeight: 48, paddingVertical: 6, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 3 },
    active: { backgroundColor: c.accentSoft },
    label: { fontSize: font(13), lineHeight: font(17), color: c.secondary, textAlign: 'center', fontWeight: '600', flexShrink: 1 },
    activeLabel: { color: c.accent, fontWeight: '800' },
    pressed: { backgroundColor: c.accentSoft },
});
