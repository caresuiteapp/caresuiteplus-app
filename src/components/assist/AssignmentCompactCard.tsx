import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useMemo, useState } from 'react';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { AssignmentCardHoverDetails } from '@/components/assist/AssignmentCardHoverDetails';
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
  const [hovered, setHovered] = useState(false);
  const travelTime = useAssignmentTravelTime(assignment, {
    enabled: showHoverDetails && hovered,
  });

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
        clientName: { ...typography.bodyStrong, flex: 1, flexShrink: 1, color: text.primary },
        statusStack: { alignItems: 'flex-end', gap: 4 },
        scheduleRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          alignItems: 'center',
        },
        weekday: { ...typography.caption, color: statusAccent.color, fontWeight: '600' },
        timeRange: { ...typography.caption, color: text.secondary },
        duration: { ...typography.caption, color: text.muted },
        serviceRow: { gap: 2 },
        serviceName: { ...typography.caption, color: text.primary, fontWeight: '600' },
        sgbRef: { ...typography.caption, color: text.muted },
        metaRow: { ...typography.caption, color: text.secondary },
        locationRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          alignItems: 'center',
        },
        location: { ...typography.caption, color: text.muted, flex: 1 },
        travel: { ...typography.caption, color: text.muted },
        travelUnavailable: { opacity: 0.65 },
        footerChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: spacing.xs,
        },
        actions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        actionBtn: { flexGrow: 1, minWidth: 72 },
        hoverHost: {
          ...(Platform.OS === 'web'
            ? ({ position: 'relative' } as ViewStyle)
            : null),
        },
      }),
    [accentModule, statusAccent.color, statusAccent.tint, text],
  );

  const webHoverProps =
    Platform.OS === 'web' && showHoverDetails
      ? ({
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } as Record<string, unknown>)
      : {};

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

        <View style={styles.footerChips}>
          {footerChips.map((chip) => (
            <PremiumBadge key={chip.id} label={chip.label} variant={chip.variant} />
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
    <View style={styles.hoverHost} {...webHoverProps}>
      {onPress ? <Pressable onPress={onPress}>{card}</Pressable> : card}
      {showHoverDetails && hovered ? (
        <AssignmentCardHoverDetails assignment={assignment} />
      ) : null}
    </View>
  );
}
