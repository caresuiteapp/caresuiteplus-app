import { StyleSheet, View } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { AssignmentCompactCard } from '@/components/assist/AssignmentCompactCard';
import type { AssignmentListItem } from '@/types/modules/assist';
import { careSpacing } from '@/design/tokens/spacing';

/** Max width for assignment cards — one card per row, centered on wide screens. */
const CARD_LIST_MAX_WIDTH = 840;

type AssignmentsCardGridProps = {
  assignments: AssignmentListItem[];
  selectedId?: string | null;
  showHoverDetails?: boolean;
  showInlineActions?: boolean;
  onAssignmentPress?: (id: string) => void;
  onOpen?: (id: string) => void;
  onStart?: (id: string) => void;
  onEdit?: (id: string) => void;
  onMore?: (id: string) => void;
  onCardTap?: (assignment: AssignmentListItem) => void;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
};

export function AssignmentsCardGrid({
  assignments,
  selectedId = null,
  showHoverDetails = false,
  showInlineActions = true,
  onOpen,
  onStart,
  onEdit,
  onMore,
  onCardTap,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
}: AssignmentsCardGridProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          width: '100%',
          gap: careSpacing.md,
        },
        grid: {
          flexDirection: 'column',
          gap: careSpacing.md,
          width: '100%',
          maxWidth: CARD_LIST_MAX_WIDTH,
          alignSelf: 'center',
        },
        cell: {
          width: '100%',
          minWidth: 0,
        },
      }),
    [],
  );

  if (assignments.length === 0 && ListEmptyComponent) {
    return (
      <View style={styles.host}>
        {ListHeaderComponent}
        {ListEmptyComponent}
        {ListFooterComponent}
      </View>
    );
  }

  return (
    <View style={styles.host}>
      {ListHeaderComponent}
      <View style={styles.grid}>
        {assignments.map((assignment) => (
          <View key={assignment.id} style={styles.cell}>
            <AssignmentCompactCard
              assignment={assignment}
              selected={selectedId === assignment.id}
              showHoverDetails={showHoverDetails}
              showInlineActions={showInlineActions}
              onPress={onCardTap ? () => onCardTap(assignment) : undefined}
              onOpen={onOpen ? () => onOpen(assignment.id) : undefined}
              onStart={onStart ? () => onStart(assignment.id) : undefined}
              onEdit={onEdit ? () => onEdit(assignment.id) : undefined}
              onMore={onMore ? () => onMore(assignment.id) : undefined}
            />
          </View>
        ))}
      </View>
      {ListFooterComponent}
    </View>
  );
}
