import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { agendaFocusRing } from './EmployeePortalAgendaAction';
import { EmployeePortalAgendaBoard, type useEmployeePortalAgendaLayout } from './EmployeePortalAgendaLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

type IconName = keyof typeof Ionicons.glyphMap;

export const clientRecordTextWrap = Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as TextStyle : undefined;

export function ClientRecordViewport({ layout, testID, children }: {
  layout: ReturnType<typeof useEmployeePortalAgendaLayout>;
  testID: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.viewport} contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" testID={testID}>
      <EmployeePortalAgendaBoard layout={layout}>{children}</EmployeePortalAgendaBoard>
    </ScrollView>
  );
}

export function ClientRecordBadge({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.badge, active && styles.activeBadge]}>
      <Text style={[styles.badgeText, active && styles.activeBadgeText]}>{label}</Text>
    </View>
  );
}

export function ClientRecordPanel({ title, icon, children }: { title: string; icon: IconName | ReactElement; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeading}>
        <View style={styles.panelIcon}>
          {typeof icon === 'string' ? <Ionicons name={icon} size={18} color={c.accent} accessible={false} /> : icon}
        </View>
        <Text accessibilityRole="header" aria-level={2} style={styles.panelTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function ClientRecordLink({ title, detail, icon, actionIcon = 'chevron-forward', accessibilityLabel, onPress }: {
  title: string;
  detail?: string;
  icon: IconName;
  actionIcon?: IconName;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        styles.row, hovered && styles.hover, focused && styles.focus, pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={18} color={c.accent} accessible={false} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Ionicons name={actionIcon} size={16} color={c.accent} accessible={false} />
    </Pressable>
  );
}

export function ClientRecordLoading({ message }: { message: string }) {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={message} accessibilityState={{ busy: true }}>
      <ActivityIndicator color={c.accent} />
      <Text style={styles.loading}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  viewport: {
    flex: 1, minWidth: 0, minHeight: 0, width: '100%',
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,.4) transparent', overscrollBehaviorY: 'contain',
    } as unknown as ViewStyle : {}),
  },
  scrollContent: { flexGrow: 0, flexShrink: 0, paddingBottom: 28 },
  panel: {
    minWidth: 0, gap: 10, padding: 14, backgroundColor: c.panel,
    borderWidth: 1, borderColor: c.line, borderRadius: 17,
  },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  panelIcon: {
    width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.selected,
  },
  panelTitle: {
    minWidth: 0, flexShrink: 1, color: c.text, fontSize: font(17), lineHeight: font(23),
    fontWeight: '800', ...clientRecordTextWrap,
  },
  badge: {
    alignSelf: 'flex-start', flexShrink: 1, minWidth: 0, maxWidth: '100%',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
    backgroundColor: c.selected, borderWidth: 1, borderColor: c.line,
  },
  badgeText: { color: c.accent, fontSize: font(11), lineHeight: font(15), fontWeight: '700', ...clientRecordTextWrap },
  activeBadge: { backgroundColor: 'rgba(91,207,168,.15)', borderColor: 'rgba(167,239,214,.32)' },
  activeBadgeText: { color: '#B9F3DF' },
  row: {
    minHeight: 44, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10,
    borderWidth: 1, borderColor: c.line, borderRadius: 11, backgroundColor: c.control,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { color: c.text, fontSize: font(13), lineHeight: font(18), fontWeight: '700', ...clientRecordTextWrap },
  rowDetail: { color: c.muted, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  loading: { color: c.muted, flexShrink: 1, fontSize: font(13), lineHeight: font(18) },
  hover: { backgroundColor: c.selected, borderColor: c.accent },
  focus: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
