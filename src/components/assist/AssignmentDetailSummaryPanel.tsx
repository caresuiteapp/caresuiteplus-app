import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel';

type AssignmentDetailSummaryPanelProps = {
  assignmentId: string;
  onOpenFullRecord?: () => void;
};

/** Preview panel — delegates to tabbed disposition panel in preview mode. */
export function AssignmentDetailSummaryPanel({
  assignmentId,
  onOpenFullRecord,
}: AssignmentDetailSummaryPanelProps) {
  return (
    <AssignmentDetailTabsPanel
      assignmentId={assignmentId}
      mode="preview"
      onOpenFullRecord={onOpenFullRecord}
    />
  );
}
