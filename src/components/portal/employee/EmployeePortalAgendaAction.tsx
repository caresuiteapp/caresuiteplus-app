import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { employeePortalDesign as c } from './employeePortalDesign';

type Props = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
};

export function EmployeePortalAgendaAction({ label, icon, onPress, primary = false, busy = false }: Props) {
  const ink = primary ? c.canvas : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        styles.action,
        primary && styles.primary,
        hovered && !primary && styles.hovered,
        focused && styles.focused,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={ink} /> : <Ionicons name={icon} color={ink} size={16} accessible={false} />}
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

export const agendaFocusRing = Platform.OS === 'web'
  ? ({ outlineColor: c.accent, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 } as ViewStyle)
  : null;

const styles = StyleSheet.create(withCareSuiteTypography({
  action: {
    minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center',
    gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.line,
    borderRadius: 11, backgroundColor: c.control,
  },
  label: { flexShrink: 1, fontSize: font(13), lineHeight: font(18), fontWeight: '700' },
  primary: { borderColor: c.accent, backgroundColor: c.accent },
  hovered: { backgroundColor: c.selected, borderColor: c.accent },
  focused: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
