import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { CaseDetailSummaryPanel } from '@/components/beratung/CaseDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { CasesListScreen } from './CasesListScreen';

export function CasesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <CasesListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <CasesListScreen embedded selectedId={selectedId} onCasePress={setSelectedId} />
      }
      detail={selectedId ? <CaseDetailSummaryPanel caseId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
