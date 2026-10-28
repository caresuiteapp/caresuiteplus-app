// Generated native presentation from src/components/office/employeedetailmodal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { PersonnelDialog } from "./PersonnelDialog.native.tsx";
import { EmployeePersonnelFilePanel } from "./EmployeePersonnelFilePanel.native.tsx";
import { EmployeeEditForm } from "./employeeeditform.native.tsx";
type Props = {
    visible: boolean;
    employeeId: string | null;
    onClose: () => void;
    onDeleted?: () => void;
    initialEditOpen?: boolean;
};
export function EmployeeDetailModal(props: Props) {
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    return <EmployeeDialogContent key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}:${props.employeeId}`} {...props}/>;
}
function EmployeeDialogContent({ visible, employeeId, onClose, onDeleted, initialEditOpen = false }: Props) {
    const router = useRouter();
    const params = useLocalSearchParams<{
        edit?: string;
    }>();
    const [initialEditing, setInitialEditing] = useState(initialEditOpen);
    const editing = params.edit === '1' || initialEditing;
    const [revision, setRevision] = useState(0);
    const endEdit = () => { setInitialEditing(false); router.setParams({ edit: undefined }); };
    return <PersonnelDialog visible={visible && !!employeeId} title={editing ? 'Personalakte bearbeiten' : 'Personalakte'} form={editing} onClose={editing ? endEdit : onClose}>
    {employeeId ? editing ? <EmployeeEditForm employeeId={employeeId} onCancel={endEdit} onUpdated={() => { setRevision(value => value + 1); endEdit(); }}/> : <EmployeePersonnelFilePanel key={revision} employeeId={employeeId} embeddedInModal onDeleted={onDeleted} onEditMasterData={() => router.setParams({ edit: '1' })}/> : null}
  </PersonnelDialog>;
}
