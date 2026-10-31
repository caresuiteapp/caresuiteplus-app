// Generated native presentation from src/screens/pflege/PflegeplanungListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { CarePlansListView } from "../../components/pflege/CarePlansListView.native.tsx";
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useCarePlanList } from "../../hooks/useCarePlanList.native.ts";
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
/** Arbeitsplan 053 — /pflege/planung */
export function PflegeplanungListScreen() {
    const router = useRouter();
    const { can, roleLabel } = usePermissions();
    const isReadOnly = !can('pflege.plans.manage');
    const canCreate = can('pflege.plans.manage');
    const list = useCarePlanList();
    if (list.loading && list.allItems.length === 0) {
        return (<ScreenShell title="Pflegeplanung" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Pflegepläne werden geladen…"/>
      </ScreenShell>);
    }
    if (list.error && list.allItems.length === 0) {
        return (<ScreenShell title="Pflegeplanung" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh}/>
      </ScreenShell>);
    }
    return (<ScreenShell title="Pflegeplanung" subtitle={`Pflegepläne und Maßnahmen · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`} rightSlot={canCreate ? (<PremiumButton title="+ Neu" size="sm" onPress={() => { if (list.isCurrent() && can('pflege.plans.manage'))
            router.push('/pflege/planung/new' as never); }}/>) : null} scroll={false}>
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (<EmptyState title="Keine Pflegepläne" message="Es sind noch keine Pflegepläne angelegt."/>) : (<CarePlansListView list={list}/>)}
      </View>
    </ScreenShell>);
}
void fetchCarePlanList;
const styles = StyleSheet.create({ content: { flex: 1 } });
