import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { AssignmentCompactCard } from '@/components/assist/AssignmentCompactCard';
import type { AssignmentListItem } from '@/types/modules/assist';
import { useResponsiveValue } from '@/hooks/useResponsiveValue';
import { careSpacing } from '@/design/tokens/spacing';

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
  const { width } = useWindowDimensions();
  const minCardWidth = useResponsiveValue({
    phone: width - careSpacing.md * 2,
    tablet: 280,
    desktop: 280,
    wide: 260,
  });
  const columns = useResponsiveValue({
    phone: 1,
    tablet: 2,
    desktop: 3,
    wide: 4,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: { width: '100%', gap: careSpacing.md },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: careSpacing.md,
          width: '100%',
        },
        cell: {
          minWidth: 0,
          flexGrow: 1,
        },
      }),
    [],
  );

  const cellStyle =
    columns === 1
      ? { width: '100%' as const }
      : {
          width: `${100 / columns - 1.5}%` as const,
          minWidth: minCardWidth,
          maxWidth: columns === 1 ? undefined : (`${100 / columns}%` as const),
        };

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
          <View key={assignment.id} style={[styles.cell, cellStyle]}>
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
