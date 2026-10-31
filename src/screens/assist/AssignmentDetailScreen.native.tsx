// Generated native presentation from src/screens/assist/AssignmentDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AssignmentDetailTabsPanel, isAssignmentDetailTabKey } from "../../components/assist/AssignmentDetailTabsPanel.native.tsx";
import { AssignmentsWorkspaceShell } from "../../components/assist/AssignmentsWorkspaceShell.native.tsx";
type Props = {
    assignmentId?: string;
    embedded?: boolean;
    onClose?: () => void;
};
export function AssignmentDetailScreen({ assignmentId: propId, embedded = false, onClose }: Props = {}) {
    const params = useLocalSearchParams<{
        id?: string | string[];
        tab?: string | string[];
    }>();
    const id = propId ?? (Array.isArray(params.id) ? params.id[0] : params.id);
    const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const router = useRouter();
    const back = () => {
        if (onClose)
            onClose();
        else if (router.canGoBack())
            router.back();
        else
            router.replace('/assist/assignments');
    };
    const content = id ? <AssignmentDetailTabsPanel assignmentId={id} initialTab={tab && isAssignmentDetailTabKey(tab) ? tab : 'overview'} onClose={embedded ? onClose : undefined} onDeleted={back}/> : <NativeDiv className="aw-alert" data-tone="danger" role="alert">Kein Einsatz ausgewählt. Bitte öffnen Sie einen Eintrag aus der Einsatzübersicht.</NativeDiv>;
    return <AssignmentsWorkspaceShell title="Einsatzdetails" description="Planung, Aufgaben, Durchführung und Nachweis an einem Ort." onBack={back}>{content}</AssignmentsWorkspaceShell>;
}
