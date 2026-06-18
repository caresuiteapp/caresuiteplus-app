import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { EmployeeDetailSummaryPanel } from '@/components/office/EmployeeDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { EmployeesListScreen } from './EmployeesListScreen';

export function EmployeesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <EmployeesListScreen />;
  }

  return (
    <AdaptiveListDetail
      list={
        <EmployeesListScreen
          embedded
          selectedId={selectedId}
          onEmployeePress={setSelectedId}
        />
      }
      detail={
        selectedId ? <EmployeeDetailSummaryPanel employeeId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
