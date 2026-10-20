import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { ReportDetailSummaryPanel } from '@/components/reporting/ReportDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { ReportsListScreen } from './ReportsListScreen';

export function ReportsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('ReportsAdaptiveScreen.record', null);

  if (!useMasterDetail) {
    return <ReportsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <ReportsListScreen embedded selectedId={selectedId} onReportPress={setSelectedId} />
      }
      detail={selectedId ? <ReportDetailSummaryPanel reportId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
