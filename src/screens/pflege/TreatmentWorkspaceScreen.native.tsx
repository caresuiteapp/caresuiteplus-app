// Generated native presentation from src/screens/pflege/TreatmentWorkspaceScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, PremiumButton } from '@/components/ui';
import { treatmentWorkspaceView } from '@/lib/pflege/treatmentWorkspaceNavigation';
import { TreatmentExecutionListScreen } from "./TreatmentExecutionListScreen.native.tsx";
import { DailyProtocolScreen } from "./DailyProtocolScreen.native.tsx";
import { ClinicalControlScreen } from "./ClinicalControlScreen.native.tsx";
import { InfusionCourseScreen } from "./InfusionCourseScreen.native.tsx";
import { TreatmentCareWorkspaceScreen } from "./TreatmentCareWorkspaceScreen.native.tsx";
export function TreatmentWorkspaceScreen() {
    const params = useLocalSearchParams(), router = useRouter();
    let view, error: string | null = null;
    try {
        view = treatmentWorkspaceView(params.view);
    }
    catch (e) {
        error = e instanceof Error ? e.message : 'Pflegeansicht nicht verfügbar.';
    }
    if (error)
        return <ScreenShell title="Behandlungspflege"><ErrorState message={error}/><PremiumButton title="Behandlungspflege erneut öffnen" onPress={() => router.replace('/pflege/behandlungspflege' as never)}/></ScreenShell>;
    if (view === 'protocols')
        return <DailyProtocolScreen />;
    if (view === 'controls')
        return <ClinicalControlScreen />;
    if (view === 'infusions')
        return <InfusionCourseScreen />;
    if (view === 'care-packet')
        return <TreatmentCareWorkspaceScreen />;
    return <TreatmentExecutionListScreen />;
}
