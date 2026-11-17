import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCarePlanDetail } from '@/hooks/useCarePlanDetail';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions';
import { CarePlanEditor } from './CarePlanCreateScreen';

export function CarePlanEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rights = useCareRuntimePermissions();
  const detail = useCarePlanDetail(id);
  const title = 'Pflegeplan bearbeiten';
  if (rights.loading || detail.loading) return <ScreenShell title={title}><LoadingState message="Pflegeplan wird geladen…" /></ScreenShell>;
  if (!rights.canAll(['pflege.plans.view', 'pflege.plans.manage'])) {
    return <ScreenShell title={title}><ErrorState message={rights.error ?? 'Das Recht zur Pflegeplanung fehlt.'} onRetry={rights.refreshPermissions} /></ScreenShell>;
  }
  if (detail.error || !detail.data || detail.data.id !== id || !detail.isCurrent()) {
    return <ScreenShell title={title}><ErrorState message={detail.error ?? 'Diese Planung konnte nicht geladen werden.'} onRetry={detail.refresh} /></ScreenShell>;
  }
  if (detail.data.status === 'archiviert') {
    return <ScreenShell title={title}><ErrorState message="Diese Planung ist archiviert." /></ScreenShell>;
  }
  return <CarePlanEditor key={`${detail.data.tenantId}:${id}:${detail.data.version}`} plan={detail.data} />;
}
