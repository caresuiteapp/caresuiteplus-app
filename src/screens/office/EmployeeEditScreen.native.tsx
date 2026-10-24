// Generated native presentation from src/screens/office/EmployeeEditScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeeEditForm } from "../../components/office/employeeeditform.native.tsx";
import { useWebBackNavigation } from "../../hooks/useWebBackNavigation.native.ts";
export function EmployeeEditScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const back = useWebBackNavigation(id ? `/business/office/employees/${id}/personnel` : '/business/office/employees');
    return <ScreenShell title="Personalakte bearbeiten" subtitle="Personal · Angaben ändern" scroll={false}>{id ? <EmployeeEditForm employeeId={id} onCancel={back} onUpdated={back}/> : <NativeDiv role="alert">Die Personalakte wurde nicht gefunden.</NativeDiv>}</ScreenShell>;
}
