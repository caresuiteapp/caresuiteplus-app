import { StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import {
  formatCalendarEventCompactLabel,
  isCancelledCalendarEvent,
  resolveCalendarEventDisplay,
} from '@/lib/calendar/calendarEventDisplay';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarStatus';

export type CalendarEventLabelVariant = 'stacked' | 'compact' | 'inline';

type CalendarEventLabelProps = {
  event: CalendarEvent;
  variant?: CalendarEventLabelVariant;
  showTime?: boolean;
  showService?: boolean;
  numberOfLines?: number;
};

export function CalendarEventLabel({
  event,
  variant = 'stacked',
  showTime = true,
  showService = true,
  numberOfLines,
}: CalendarEventLabelProps) {
  const text = useAuroraAdaptiveText();
  const display = resolveCalendarEventDisplay(event);
  const isCancelled = isCancelledCalendarEvent(event);
  const assignmentVisual = resolveAssignmentCalendarVisual(event);

  const statusFlag = assignmentVisual ? (
    <View
      style={[
        styles.statusFlag,
        {
          backgroundColor: assignmentVisual.tint,
          borderColor: assignmentVisual.outline,
        },
      ]}
    >
      <Text style={[styles.statusSymbol, { color: assignmentVisual.color }]}>
        {assignmentVisual.symbol}
      </Text>
      <Text style={[styles.statusText, { color: assignmentVisual.color }]}>
        {assignmentVisual.label.toUpperCase()}
      </Text>
    </View>
  ) : null;

  if (!display.isAssignment) {
    if (variant === 'compact' || variant === 'inline') {
      return (
        <Text
          style={[styles.compact, { color: text.primary }]}
          numberOfLines={numberOfLines ?? 1}
        >
          {formatCalendarEventCompactLabel(event, { includeTime: showTime })}
        </Text>
      );
    }

    return (
      <View style={styles.stack}>
        <Text style={[styles.primary, { color: text.primary }]} numberOfLines={numberOfLines ?? 2}>
          {display.primaryLine}
        </Text>
        {showTime && display.timeRange ? (
          <Text style={[styles.meta, { color: text.muted }]}>{display.timeRange}</Text>
        ) : null}
      </View>
    );
  }

  if (variant === 'compact' || variant === 'inline') {
    return (
      <View style={styles.compactStack}>
        {statusFlag}
        <Text
          style={[
            styles.compact,
            { color: isCancelled ? text.muted : text.primary },
            isCancelled && styles.cancelledText,
            variant === 'inline' && styles.inline,
          ]}
          numberOfLines={numberOfLines ?? (variant === 'compact' ? 2 : 3)}
        >
          {formatCalendarEventCompactLabel(event, { includeTime: showTime })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {statusFlag}
      <Text style={[styles.primary, styles.bold, { color: text.primary }]} numberOfLines={1}>
        {display.clientName ?? display.primaryLine}
      </Text>
      {showTime && display.timeRange ? (
        <Text style={[styles.meta, { color: text.muted }]} numberOfLines={1}>
          {display.timeRange}
        </Text>
      ) : null}
      {display.employeeName ? (
        <Text style={[styles.secondary, { color: text.secondary }]} numberOfLines={1}>
          {display.employeeName}
        </Text>
      ) : null}
      {showService && display.serviceTitle ? (
        <Text style={[styles.service, { color: text.muted }]} numberOfLines={1}>
          {display.serviceTitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 1,
  },
  primary: {
    fontSize: 11,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 10,
  },
  secondary: {
    fontSize: 10,
    fontWeight: '500',
  },
  service: {
    fontSize: 9,
  },
  compact: {
    fontSize: 11,
    fontWeight: '500',
  },
  compactStack: {
    gap: 1,
  },
  statusFlag: {
    alignSelf: 'flex-start',
    minHeight: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusSymbol: {
    width: 9,
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
  },
  statusText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  cancelledText: {
    textDecorationLine: 'line-through',
    opacity: 0.78,
  },
  inline: {
    fontSize: 13,
    fontWeight: '600',
  },
});
