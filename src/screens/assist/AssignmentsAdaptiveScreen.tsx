import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { AssignmentDetailSummaryPanel } from '@/components/assist/AssignmentDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { AssignmentsListScreen } from './AssignmentsListScreen';

export function AssignmentsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <AssignmentsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <AssignmentsListScreen
          embedded
          selectedId={selectedId}
          onAssignmentPress={setSelectedId}
        />
      }
      detail={
        selectedId ? <AssignmentDetailSummaryPanel assignmentId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
