import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useMemo, useState } from 'react';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { AssignmentCardHoverDetails } from '@/components/assist/AssignmentCardHoverDetails';
import {
  buildAssignmentFooterChips,
  resolveAssignmentCardAccent,
  resolveSgbReference,
  resolveTravelTimeMinutes,
} from '@/lib/assist/assignmentCardPresentation';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  formatAssignmentTimeRange,
  formatDurationMinutes,
  formatWeekday,
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
  onPress,
}: AssignmentCompactCardProps) {
  const text = useAuroraAdaptiveText();
  const accentModule = moduleColor('assist');
  const statusAccent = resolveAssignmentCardAccent(assignment.status);
  const footerChips = buildAssignmentFooterChips(assignment);
  const sgbRef = resolveSgbReference(assignment);
  const travelMinutes = resolveTravelTimeMinutes(assignment);
  const [hovered, setHovered] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardWrap: {
          position: 'relative',
          marginBottom: 0,
        },
        card: {
          overflow: 'hidden',
          backgroundColor: statusAccent.tint,
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
        },
        headerRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        clientName: { ...typography.bodyStrong, flex: 1, flexShrink: 1, color: text.primary },
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
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[assignment.status]}
            variant={
              assignment.status === 'abgeschlossen'
                ? 'green'
                : assignment.status === 'entwurf' || assignment.status === 'in_bearbeitung'
                  ? 'orange'
                  : assignment.status === 'aktiv'
                    ? 'cyan'
                    : assignment.status === 'fehlerhaft' || assignment.status === 'gesperrt'
                      ? 'red'
                      : 'muted'
            }
            dot
          />
        </View>

        <View style={styles.scheduleRow}>
          <Text style={styles.weekday}>{formatWeekday(assignment.scheduledStart)}</Text>
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
          {travelMinutes != null ? (
            <Text style={styles.travel}>🚗 {travelMinutes} Min.</Text>
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
            {onStart ? (
              <PremiumButton
                title="Start"
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
          </View>
        ) : null}
      </View>
    </>
  );

  const card = onPress ? (
    <Pressable onPress={onPress} {...webHoverProps}>
      <PremiumCard
        style={[styles.cardWrap, styles.card, selected ? styles.cardSelected : null]}
        accentColor={statusAccent.color}
      >
        {cardBody}
      </PremiumCard>
    </Pressable>
  ) : (
    <View style={styles.hoverHost} {...webHoverProps}>
      <PremiumCard
        style={[styles.cardWrap, styles.card, selected ? styles.cardSelected : null]}
        accentColor={statusAccent.color}
      >
        {cardBody}
      </PremiumCard>
    </View>
  );

  return (
    <View style={styles.hoverHost}>
      {card}
      {showHoverDetails && hovered ? (
        <AssignmentCardHoverDetails assignment={assignment} />
      ) : null}
    </View>
  );
}
