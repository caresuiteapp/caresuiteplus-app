import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { OfficeRecordDeleteButton } from '@/components/office/OfficeRecordDeleteButton';
import {
  buildAssignmentFooterChips,
  isAssignmentListItemDeletable,
  resolveAssignmentCardAccent,
  resolveAssignmentCardBadge,
  resolveAssignmentExecutionBadge,
  resolveSgbReference,
} from '@/lib/assist/assignmentCardPresentation';
import type { ServiceResult } from '@/types';
import { useAssignmentTravelTime } from '@/hooks/useAssignmentTravelTime';
import type { AssignmentListItem } from '@/types/modules/assist';
import {
  formatAssignmentTimeRange,
  formatAssignmentWeekdayDate,
  formatDurationMinutes,
  formatTime,
} from '@/lib/formatters/dateTimeFormatters';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { spacing, typography } from '@/theme';

type AssignmentCompactCardProps = {
  assignment: AssignmentListItem;
  selected?: boolean;
  showHoverDetails?: boolean;
  showInlineActions?: boolean;
  onOpen?: () => void;
  onStart?: () => void;
  onEdit?: () => void;
  onMore?: () => void;
  onDelete?: () => Promise<ServiceResult<void>>;
  onDeleted?: () => void;
  onPress?: () => void;
};

export function AssignmentCompactCard({
  assignment,
  selected = false,
  showHoverDetails = false,
  showInlineActions = true,
  onOpen,
  onStart,
  onEdit,
  onMore,
  onDelete,
  onDeleted,
  onPress,
}: AssignmentCompactCardProps) {
  const text = useAuroraAdaptiveText();
  const accentModule = moduleColor('assist');
  const statusAccent = resolveAssignmentCardAccent(assignment);
  const statusBadge = resolveAssignmentCardBadge(assignment);
  const executionBadge = resolveAssignmentExecutionBadge(assignment);
  const canDelete = isAssignmentListItemDeletable(assignment);
  const footerChips = buildAssignmentFooterChips(assignment);
  const sgbRef = resolveSgbReference(assignment);
  const travelTime = useAssignmentTravelTime(assignment, {
    enabled: showHoverDetails,
  });
  const lifecycleTimes = [
    { label: 'Anfahrt', value: assignment.onTheWayAt },
    { label: 'Angekommen', value: assignment.arrivedAt },
    { label: 'Einsatzstart', value: assignment.actualStartAt },
    { label: 'Einsatzende', value: assignment.actualEndAt },
  ];
  const showLifecycleTimes = lifecycleTimes.some((entry) => Boolean(entry.value));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardWrap: {
          position: 'relative',
          marginBottom: 0,
        },
        card: {
          overflow: 'hidden',
        },
        cardSelected: {
          borderColor: accentModule,
          borderWidth: 2,
        },
        accentBar: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: statusAccent.color,
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
        },
        inner: {
          paddingLeft: spacing.md + 4,
          paddingRight: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          position: 'relative',
          zIndex: 1,
        },
        headerRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        clientName: { ...typography.h3, flex: 1, flexShrink: 1, color: text.primary },
        statusStack: { alignItems: 'flex-end', gap: 4 },
        scheduleRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          alignItems: 'center',
        },
        weekday: { ...typography.label, color: statusAccent.color, fontWeight: '700' },
        timeRange: { ...typography.label, color: text.primary },
        duration: { ...typography.label, color: text.secondary },
        serviceRow: { gap: 2 },
        serviceName: { ...typography.label, color: text.primary, fontWeight: '700' },
        sgbRef: { ...typography.label, color: text.secondary },
        metaRow: { ...typography.label, color: text.primary },
        locationRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          alignItems: 'center',
        },
        location: { ...typography.label, color: text.secondary, flex: 1 },
        travel: { ...typography.label, color: text.secondary },
        travelUnavailable: { opacity: 0.65 },
        lifecycleRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.xs,
          paddingVertical: spacing.xs,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'rgba(148, 163, 184, 0.22)',
        },
        lifecycleItem: { flex: 1, flexBasis: 112, minWidth: 112, gap: 1 },
        lifecycleLabel: { ...typography.caption, color: text.muted, fontWeight: '600' },
        lifecycleValue: { ...typography.label, color: text.primary, fontWeight: '700' },
        footerChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: spacing.xs,
        },
        footerChip: {
          flexGrow: 0,
          flexShrink: 1,
          minWidth: 118,
          justifyContent: 'center',
        },
        actions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.sm,
          alignItems: 'center',
        },
        actionBtn: {
          flexGrow: 0,
          flexShrink: 1,
          minWidth: 104,
          maxWidth: 176,
        },
      }),
    [accentModule, statusAccent.color, statusAccent.tint, text],
  );

  const cardBody = (
    <>
      <View style={styles.accentBar} />
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <Text style={styles.clientName}>{assignment.clientName}</Text>
          <View style={styles.statusStack}>
            <HealthOSStatusBadge
              domain="assignment"
              technicalValue={statusBadge.assignmentStatus}
              dot
            />
            <PremiumBadge
              label={executionBadge.label}
              variant={executionBadge.variant}
              dot
            />
          </View>
        </View>

        <View style={styles.scheduleRow}>
          <Text style={styles.weekday}>
            {formatAssignmentWeekdayDate(assignment.scheduledStart)}
          </Text>
          <Text style={styles.timeRange}>
            {formatAssignmentTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}
          </Text>
          {assignment.durationMinutes ? (
            <Text style={styles.duration}>
              · {formatDurationMinutes(assignment.durationMinutes)}
            </Text>
          ) : null}
        </View>

        <View style={styles.serviceRow}>
          <Text style={styles.serviceName}>{assignment.serviceName ?? assignment.title}</Text>
          <Text style={styles.sgbRef}>{sgbRef}</Text>
        </View>

        <Text style={styles.metaRow}>{assignment.employeeName}</Text>

        <View style={styles.locationRow}>
          <Text style={styles.location} numberOfLines={1}>
            {assignment.location}
          </Text>
          {travelTime.displayText ? (
            <Text
              style={[
                styles.travel,
                travelTime.error && !travelTime.loading ? styles.travelUnavailable : null,
              ]}
            >
              {travelTime.displayText}
            </Text>
          ) : null}
        </View>

        {showLifecycleTimes ? (
          <View style={styles.lifecycleRow}>
            {lifecycleTimes.map((entry) => (
              <View key={entry.label} style={styles.lifecycleItem}>
                <Text style={styles.lifecycleLabel}>{entry.label}</Text>
                <Text style={styles.lifecycleValue}>
                  {entry.value ? formatTime(entry.value) : '—'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footerChips}>
          {footerChips.map((chip) => (
            <PremiumBadge
              key={chip.id}
              label={chip.label}
              variant={chip.variant}
              style={styles.footerChip}
            />
          ))}
        </View>

        {showInlineActions ? (
          <View style={styles.actions}>
            {onOpen ? (
              <PremiumButton
                title="Öffnen"
                variant="secondary"
                size="sm"
                onPress={onOpen}
                style={styles.actionBtn}
              />
            ) : null}
            {onStart && !['completed', 'cancelled', 'no_show'].includes(executionBadge.status) ? (
              <PremiumButton
                title={executionBadge.running ? 'Fortsetzen' : 'Start'}
                variant="primary"
                size="sm"
                onPress={onStart}
                style={styles.actionBtn}
              />
            ) : null}
            {onEdit ? (
              <PremiumButton
                title="Bearbeiten"
                variant="ghost"
                size="sm"
                onPress={onEdit}
                style={styles.actionBtn}
              />
            ) : null}
            {onMore ? (
              <PremiumButton
                title="Mehr"
                variant="ghost"
                size="sm"
                onPress={onMore}
                style={styles.actionBtn}
              />
            ) : null}
            {onDelete && canDelete ? (
              <View style={styles.actionBtn}>
                <OfficeRecordDeleteButton
                  recordLabel="Einsatz"
                  displayName={`${assignment.clientName} · ${formatAssignmentWeekdayDate(assignment.scheduledStart)}`}
                  onDelete={onDelete}
                  onDeleted={onDeleted}
                  confirmTitle="Einsatz endgültig löschen?"
                  buttonTitle="Löschen"
                  buttonSize="sm"
                  fullWidth
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );

  const card = (
    <PremiumCard
      style={[styles.cardWrap, styles.card, selected ? styles.cardSelected : null]}
      accentColor={statusAccent.color}
    >
      {cardBody}
    </PremiumCard>
  );

  return (
    <View>
      {onPress ? <Pressable onPress={onPress}>{card}</Pressable> : card}
    </View>
  );
}
