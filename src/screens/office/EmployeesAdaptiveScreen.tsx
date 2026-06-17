import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { EmployeeDetailSummaryPanel } from '@/components/office/EmployeeDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { EmployeesListScreen } from './EmployeesListScreen';

export function EmployeesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listRefreshToken, setListRefreshToken] = useState(0);

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
          refreshToken={listRefreshToken}
        />
      }
      detail={
        selectedId ? (
          <EmployeeDetailSummaryPanel
            employeeId={selectedId}
            onDeleted={() => {
              setSelectedId(null);
              setListRefreshToken((value) => value + 1);
            }}
          />
        ) : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
