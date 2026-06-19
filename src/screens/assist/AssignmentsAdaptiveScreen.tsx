import { useState } from 'react';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal';
import { AssignmentsListScreen } from './AssignmentsListScreen';

/** Full-width assignments list; row tap opens AssignmentDetailGlassModal. */
export function AssignmentsAdaptiveScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <AssignmentsListScreen onAssignmentPress={setSelectedId} selectedId={selectedId} />
      <AssignmentDetailGlassModal
        visible={!!selectedId}
        assignmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
