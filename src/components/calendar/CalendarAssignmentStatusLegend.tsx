import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  ASSIGNMENT_CALENDAR_VISUALS,
  type AssignmentCalendarState,
} from '@/lib/calendar/assignmentCalendarStatus';

const STATES: AssignmentCalendarState[] = [
  'scheduled',
  'active',
  'open',
  'problem',
  'completed',
  'cancelled',
];

// Opaque surfaces keep the status text readable on both light and dark calendar panels.
const WEB_STATUS_BACKGROUNDS: Record<AssignmentCalendarState, string> = {
  scheduled: '#EFF6FF',
  active: '#ECFEFF',
  open: '#FFFBEB',
  problem: '#FEF2F2',
  completed: '#F0FDF4',
  cancelled: '#F1F5F9',
};

export function CalendarAssignmentStatusLegend() {
  const web = Platform.OS === 'web';
  return (
    <View style={[styles.shell, web && styles.webShell]} accessibilityLabel="Farblegende für Einsatzstatus">
      <Text style={[styles.title, web && styles.webTitle]}>EINSATZSTATUS</Text>
      <View style={styles.items}>
        {STATES.map((state) => {
          const visual = ASSIGNMENT_CALENDAR_VISUALS[state];
          return (
            <View
              key={state}
              style={[
                styles.item,
                web && styles.webItem,
                { backgroundColor: web ? WEB_STATUS_BACKGROUNDS[state] : visual.tint, borderColor: visual.outline },
              ]}
            >
              <Text style={[styles.symbol, web && styles.webSymbol, { color: visual.color }]}>{visual.symbol}</Text>
              <Text style={[styles.label, web && styles.webLabel, { color: visual.color }]}>{visual.legendLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    gap: 7,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(118, 204, 255, 0.16)',
  },
  title: {
    color: '#7FDFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  item: {
    minHeight: 25,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  symbol: {
    width: 12,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  webShell: {
    padding: 12,
    gap: 10,
    backgroundColor: '#F3F8FE',
    borderWidth: 1,
    borderColor: '#C8DAEE',
    borderTopColor: '#C8DAEE',
    borderRadius: 14,
  },
  webTitle: { color: '#173859', fontSize: 11, lineHeight: 16 },
  webItem: { minHeight: 34, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 7, gap: 7 },
  webSymbol: { width: 14, fontSize: 13, lineHeight: 18 },
  webLabel: { fontSize: 13, lineHeight: 18, flexShrink: 1, minWidth: 0 },
});
