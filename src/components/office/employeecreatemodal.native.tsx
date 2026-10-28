// Generated native presentation from src/components/office/employeecreatemodal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { EmployeeCreateForm } from "./employeecreateform.native.tsx";
import { PersonnelDialog } from "./PersonnelDialog.native.tsx";
export type EmployeeCreateModalProps = {
    visible: boolean;
    onClose: () => void;
    onCreated?: (employeeId: string) => void;
};
export function EmployeeCreateModal({ visible, onClose, onCreated }: EmployeeCreateModalProps) {
    return <PersonnelDialog visible={visible} title="Mitarbeitende anlegen" form onClose={onClose}><EmployeeCreateForm onCancel={onClose} onCreated={id => { if (onCreated)
        onCreated(id);
    else
        onClose(); }}/></PersonnelDialog>;
}
