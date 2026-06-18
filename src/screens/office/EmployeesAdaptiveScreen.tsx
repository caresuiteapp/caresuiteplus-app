import { useState } from 'react';
import { AdaptiveListDetail } from '@/components/adaptive';
import { EmployeeDetailModal } from '@/components/office/employeedetailmodal';
import { EmployeeDetailSummaryPanel } from '@/components/office/EmployeeDetailSummaryPanel';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { EmployeesListScreen } from './EmployeesListScreen';

export function EmployeesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const shellHostsAurora = useShellHostsAurora();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listRefreshToken, setListRefreshToken] = useState(0);

  if (shellHostsAurora) {
    return (
      <>
        <EmployeesListScreen
          onEmployeePress={setSelectedId}
          selectedId={selectedId}
          refreshToken={listRefreshToken}
        />
        <EmployeeDetailModal
          visible={!!selectedId}
          employeeId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            setListRefreshToken((value) => value + 1);
          }}
        />
      </>
    );
  }

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
