import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { ExecutionDetailSummaryPanel } from '@/components/assist/ExecutionDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ExecutionsListScreen } from './ExecutionsListScreen';

export function ExecutionsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <ExecutionsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <ExecutionsListScreen
          embedded
          selectedId={selectedId}
          onExecutionPress={setSelectedId}
        />
      }
      detail={
        selectedId ? (
          <ExecutionDetailSummaryPanel assignmentId={selectedId} />
        ) : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
