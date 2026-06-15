import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { AppointmentDetailSummaryPanel } from '@/components/office/AppointmentDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { AppointmentsListScreen } from './AppointmentsListScreen';

export function AppointmentsAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!useMasterDetail) {
    return <AppointmentsListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <AppointmentsListScreen
          embedded
          selectedId={selectedId}
          onAppointmentPress={setSelectedId}
        />
      }
      detail={
        selectedId ? <AppointmentDetailSummaryPanel appointmentId={selectedId} /> : undefined
      }
      showDetail={!!selectedId}
    />
  );
}
