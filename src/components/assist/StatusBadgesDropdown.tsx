import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { VisitDispositionBadge } from '@/components/assist/VisitDispositionBadge';
import type { AssignmentListItem } from '@/types/modules/assist';
import {
  resolveAssignmentCardBadge,
} from '@/lib/assist/assignmentCardPresentation';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
  type VisitBillingStatus,
  type VisitPlanningStatus,
  type VisitProofStatus,
} from '@/lib/assist/visitTypes';
import {
  auroraGlass,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassChipStyles,
  useAuroraGlassModalStyle,
} from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

type BadgeVariant = 'green' | 'orange' | 'red' | 'cyan' | 'muted' | 'purple';

export type StatusBadgeItem = {
  id: string;
  label: string;
  variant: BadgeVariant;
  kind?: 'workflow' | 'disposition';
};

type StatusBadgesDropdownProps = {
  badges: StatusBadgeItem[];
};

function stopRowPress(event: GestureResponderEvent) {
  if (Platform.OS === 'web') {
    event.stopPropagation();
  }
}

function renderBadge(badge: StatusBadgeItem) {
  if (badge.kind === 'disposition') {
    return (
      <VisitDispositionBadge
        key={badge.id}
        label={badge.label}
        variant={badge.variant}
        compact
      />
    );
  }

  return <PremiumBadge key={badge.id} label={badge.label} variant={badge.variant} dot />;
}

export function StatusBadgesDropdown({ badges }: StatusBadgesDropdownProps) {
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const chipStyles = useAuroraGlassChipStyles({ viewContext: 'form' });
  const modalGlass = useAuroraGlassModalStyle({ viewContext: 'form' });
  const [open, setOpen] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
        toggle: {
          minWidth: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          ...(auroraActive ? chipStyles.chip : {
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 6,
            borderColor: auroraGlass.innerBorder,
            backgroundColor: auroraGlass.chip,
          }),
        },
        toggleText: { color: text.secondary, fontSize: 12, fontWeight: '600' },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(15, 27, 51, 0.16)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        modalSheet: {
          width: '100%',
          maxWidth: 360,
          borderRadius: 12,
          padding: spacing.md,
          gap: spacing.sm,
          ...(auroraActive ? modalGlass : {
            borderWidth: 1,
            borderColor: auroraGlass.innerBorder,
            backgroundColor: auroraGlass.modal,
          }),
        },
        modalTitle: { color: text.primary, fontWeight: '600', fontSize: 14 },
        modalBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        modalClose: { alignSelf: 'flex-end', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
        modalCloseText: { color: text.secondary, fontSize: 13, fontWeight: '600' },
      }),
    [auroraActive, chipStyles.chip, modalGlass, text],
  );

  if (badges.length === 0) return null;
  if (badges.length === 1) return renderBadge(badges[0]);

  const [primary, ...overflow] = badges;

  return (
    <View style={styles.row}>
      {renderBadge(primary)}
      <Pressable
        onPress={(event) => {
          stopRowPress(event);
          setOpen(true);
        }}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={`${overflow.length} weitere Status anzeigen`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleText}>+{overflow.length}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={styles.modalSheet}
            onPress={(event) => {
              stopRowPress(event);
              event.stopPropagation();
            }}
          >
            <Text style={styles.modalTitle}>Status</Text>
            <View style={styles.modalBadges}>
              {badges.map((badge) => renderBadge(badge))}
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Schließen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function buildAssignmentStatusBadges(assignment: AssignmentListItem): StatusBadgeItem[] {
  const planning = (assignment.planningStatus as VisitPlanningStatus) ?? 'scheduled';
  const proof = (assignment.proofStatus as VisitProofStatus) ?? 'none';
  const billing = (assignment.billingStatus as VisitBillingStatus) ?? 'none';
  const primaryBadge = resolveAssignmentCardBadge(assignment);

  const badges: StatusBadgeItem[] = [
    {
      id: 'assignment',
      label: primaryBadge.label,
      variant: primaryBadge.variant,
      kind: 'workflow',
    },
    {
      id: 'planning',
      label: VISIT_PLANNING_STATUS_LABELS[planning],
      variant: planning === 'at_risk' || planning === 'cancelled' ? 'red' : 'cyan',
      kind: 'disposition',
    },
  ];

  if (proof !== 'none') {
    badges.push({
      id: 'proof',
      label: VISIT_PROOF_STATUS_LABELS[proof],
      variant: proof === 'rejected' ? 'red' : 'purple',
      kind: 'disposition',
    });
  }

  if (billing !== 'none') {
    badges.push({
      id: 'billing',
      label: VISIT_BILLING_STATUS_LABELS[billing],
      variant: billing === 'blocked' ? 'red' : 'orange',
      kind: 'disposition',
    });
  }

  if (assignment.isAtRisk && planning !== 'at_risk') {
    badges.push({
      id: 'at_risk',
      label: 'Gefährdet',
      variant: 'red',
      kind: 'disposition',
    });
  }

  if (assignment.isIncomplete) {
    badges.push({
      id: 'incomplete',
      label: 'Unvollständig',
      variant: 'orange',
      kind: 'disposition',
    });
  }

  return badges;
}
