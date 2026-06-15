import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { InvoiceDetailSummaryPanel } from '@/components/office/InvoiceDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { InvoicesListScreen } from './InvoicesListScreen';

export function InvoicesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <InvoicesListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <InvoicesListScreen
          embedded
          selectedId={selectedId}
          onInvoicePress={setSelectedId}
        />
      }
      detail={
        selectedId ? <InvoiceDetailSummaryPanel invoiceId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
