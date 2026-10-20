import { usePageRecord } from '@/hooks/usePageRecord';
import { useState } from 'react';
import { MasterDetailLayout } from '@/components/layout';
import { CourseDetailSummaryPanel } from '@/components/akademie/CourseDetailSummaryPanel';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { CoursesListScreen } from './CoursesListScreen';

export function CoursesAdaptiveScreen() {
  const { useMasterDetail } = usePlatformLayout();
  const [selectedId, setSelectedId] = usePageRecord<string | null>('CoursesAdaptiveScreen.record', null);

  if (!useMasterDetail) {
    return <CoursesListScreen />;
  }

  return (
    <MasterDetailLayout
      master={
        <CoursesListScreen embedded selectedId={selectedId} onCoursePress={setSelectedId} />
      }
      detail={selectedId ? <CourseDetailSummaryPanel courseId={selectedId} /> : undefined}
      showDetail={!!selectedId}
    />
  );
}
