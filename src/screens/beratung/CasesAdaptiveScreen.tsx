import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { CaseDetailSummaryPanel } from '@/components/beratung/CaseDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { CasesListScreen } from './CasesListScreen';

export function CasesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('CasesAdaptiveScreen.record', null);

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
