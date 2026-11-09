import type { ReactElement } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { employeePortalDesign as c } from './employeePortalDesign';

type Props = {
  label: string;
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap | ReactElement;
  iconOnly?: boolean;
  onPress: () => void;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
};

export function EmployeePortalAgendaAction({
  label, accessibilityLabel, icon, iconOnly = false, onPress,
  primary = false, busy = false, disabled = false,
}: Props) {
  const ink = primary ? c.canvas : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (iconOnly ? label : undefined)}
      accessibilityState={{ busy, disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        styles.action,
        iconOnly && styles.iconOnly,
        primary && styles.primary,
        hovered && !primary && styles.hovered,
        focused && styles.focused,
        pressed && styles.pressed,
        disabled && !busy && styles.disabled,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={ink} />
        : typeof icon === 'string' ? <Ionicons name={icon} color={ink} size={iconOnly ? 21 : 16} accessible={false} /> : icon}
      {iconOnly ? null : <Text style={[styles.label, { color: ink }]}>{label}</Text>}
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
  iconOnly: { width: 44, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center', flexShrink: 0 },
  label: { flexShrink: 1, fontSize: font(13), lineHeight: font(18), fontWeight: '700' },
  primary: { borderColor: c.accent, backgroundColor: c.accent },
  hovered: { backgroundColor: c.selected, borderColor: c.accent },
  focused: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
}));
