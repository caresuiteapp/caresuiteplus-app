// Generated native presentation from src/screens/pflege/CarePlansListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { CarePlansListView } from "../../components/pflege/CarePlansListView.native.tsx";
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCarePlanList } from "../../hooks/useCarePlanList.native.ts";
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { CarePermissionStatus } from "./CarePermissionStatus.native.tsx";
export function CarePlansListScreen({ onPlanPress, selectedId, embedded = false, }: {
    onPlanPress?: (id: string) => void;
    selectedId?: string | null;
    embedded?: boolean;
} = {}) {
    const router = useRouter();
    const params = useLocalSearchParams<{
        status?: string;
        work?: string;
        clientId?: string;
    }>();
    const permissions = usePermissions();
    const { can } = permissions;
    const isReadOnly = !can('pflege.plans.manage');
    const pageTitle = 'Pflegepläne';
    const canCreate = can('pflege.plans.manage');
    const list = useCarePlanList({ initialStatus: params.status, initialWork: params.work, clientId: params.clientId });
    if (embedded) {
        return (<CarePlansListView list={list} onPlanPress={onPlanPress} selectedId={selectedId} embedded/>);
    }
    if (permissions.loading || permissions.error) {
        return (<ScreenShell title={pageTitle} scroll={false}>
        <CarePermissionStatus state={permissions}/>
      </ScreenShell>);
    }
    if (list.loading && list.allItems.length === 0) {
        return (<ScreenShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Pflegepläne werden geladen…"/>
      </ScreenShell>);
    }
    if (list.error && list.allItems.length === 0) {
        return (<ScreenShell title={pageTitle} subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh}/>
      </ScreenShell>);
    }
    return (<ScreenShell title={pageTitle} subtitle={`Ambulante Pflegeplanung${isReadOnly ? ' · Lesemodus' : ''}`} rightSlot={canCreate ? (<PremiumButton title="+ Neu" size="sm" onPress={() => { if (list.isCurrent() && can('pflege.plans.manage'))
            router.push('/pflege/plans/create' as never); }}/>) : null} scroll={false}>
      <View style={styles.content}>
        <CarePlansListView list={list} onPlanPress={onPlanPress} selectedId={selectedId}/>
      </View>
    </ScreenShell>);
}
void fetchCarePlanList;
const styles = StyleSheet.create({ content: { flex: 1 } });
