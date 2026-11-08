import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { HealthOSBadgeTone } from '@/components/healthos/tokens/healthosTokens';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import type { employeePortalAgendaDate } from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import { employeePortalDesign as c } from './employeePortalDesign';

const statusInk = {
  muted: c.muted, cyan: c.accent, green: '#C1F3DE',
  orange: c.warning, red: c.danger, purple: '#E2D5FF',
};

export function EmployeePortalAgendaStatus({ label, tone = 'cyan' }: { label: string; tone?: HealthOSBadgeTone }) {
  const ink = statusInk[tone];
  return (
    <View style={styles.status}>
      <View style={[styles.statusDot, { backgroundColor: ink }]} />
      <Text style={[styles.statusText, { color: ink }]}>{label}</Text>
    </View>
  );
}

export function EmployeePortalAgendaCard({ date, title, status, compact = false, tone, actions, children, testID }: {
  date: ReturnType<typeof employeePortalAgendaDate>; title: string; status?: ReactNode;
  compact?: boolean; tone?: 'past' | 'featured' | 'warning';
  actions?: ReactNode; children?: ReactNode; testID?: string;
}) {
  return (
    <View style={[styles.card, tone && styles[tone], compact && styles.cardCompact]} testID={testID}>
      <View style={[styles.cardTop, compact && styles.cardTopCompact]}>
        <View style={[styles.dateTile, tone === 'featured' && styles.featuredDate, tone === 'warning' && styles.warningDate,
          compact && styles.dateTileCompact]} accessible accessibilityLabel={date.date}>
          {compact || !date.day ? (
            <>
              <Ionicons name="calendar-outline" color={tone === 'warning' ? c.warning : c.accent} size={16} accessible={false} />
              <Text style={[styles.dateMeta, tone === 'warning' && styles.warningText]}>{date.date}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.dateMeta, tone === 'warning' && styles.warningText]}>{date.weekday}</Text>
              <Text style={styles.dateDay}>{date.day}</Text>
              <Text style={[styles.dateMeta, tone === 'warning' && styles.warningText]}>{date.monthAndYear}</Text>
            </>
          )}
        </View>
        <View style={styles.details}>
          {status ? <View style={styles.statusRow}>{status}</View> : null}
          <Text accessibilityRole="header" aria-level={3} style={styles.title}>{title}</Text>
          {children}
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  card: {
    flex: 1, minWidth: 0, padding: 16, gap: 14, borderRadius: 19,
    backgroundColor: c.panel, borderWidth: 1, borderColor: c.line,
  },
  cardCompact: { padding: 12, gap: 12 },
  past: { backgroundColor: 'rgba(220,234,248,0.06)' },
  featured: { backgroundColor: 'rgba(133,222,240,0.13)', borderColor: 'rgba(164,234,249,0.56)' },
  warning: { backgroundColor: 'rgba(255,202,139,0.075)', borderColor: 'rgba(255,206,146,0.49)' },
  warningDate: { borderColor: 'rgba(255,206,146,0.34)' },
  warningText: { color: c.warning },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, flexGrow: 1 },
  cardTopCompact: { flexDirection: 'column', gap: 10 },
  dateTile: {
    paddingHorizontal: 9, paddingVertical: 10, minWidth: 78, maxWidth: '30%',
    borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: c.control,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dateTileCompact: { maxWidth: '100%', minWidth: 0, flexDirection: 'row', gap: 7, paddingVertical: 6 },
  featuredDate: { borderColor: 'rgba(164,234,249,0.42)', backgroundColor: 'rgba(12,39,59,0.65)' },
  dateDay: { color: c.text, fontSize: font(30), lineHeight: font(34), fontWeight: '800', fontVariant: ['tabular-nums'] },
  dateMeta: { flexShrink: 1, color: c.accent, fontSize: font(12), lineHeight: font(16), textAlign: 'center', fontWeight: '700' },
  details: { minWidth: 0, flex: 1, alignSelf: 'stretch', gap: 7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  status: {
    maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: c.control, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flexShrink: 1, fontSize: font(11), lineHeight: font(15), fontWeight: '700' },
  title: { color: c.text, fontSize: font(19), lineHeight: font(24), fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderColor: c.line, paddingTop: 11 },
}));
