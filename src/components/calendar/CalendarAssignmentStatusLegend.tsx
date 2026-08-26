import { StyleSheet, Text, View } from 'react-native';
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

export function CalendarAssignmentStatusLegend() {
  return (
    <View style={styles.shell} accessibilityLabel="Farblegende für Einsatzstatus">
      <Text style={styles.title}>EINSATZSTATUS</Text>
      <View style={styles.items}>
        {STATES.map((state) => {
          const visual = ASSIGNMENT_CALENDAR_VISUALS[state];
          return (
            <View
              key={state}
              style={[
                styles.item,
                { backgroundColor: visual.tint, borderColor: visual.outline },
              ]}
            >
              <Text style={[styles.symbol, { color: visual.color }]}>{visual.symbol}</Text>
              <Text style={[styles.label, { color: visual.color }]}>{visual.legendLabel}</Text>
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
});
