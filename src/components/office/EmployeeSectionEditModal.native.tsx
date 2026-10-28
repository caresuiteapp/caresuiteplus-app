// Generated native presentation from src/components/office/EmployeeSectionEditModal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { EmployeeEditForm } from "./employeeeditform.native.tsx";
import { PersonnelDialog } from "./PersonnelDialog.native.tsx";
export type EmployeeSectionEditModalProps = {
    visible: boolean;
    employeeId: string;
    section: EmployeeEditSectionKey;
    onClose: () => void;
    onUpdated?: () => void;
    onOpenPersonnelRecord?: () => void;
};
export function EmployeeSectionEditModal({ visible, employeeId, section, onClose, onUpdated }: EmployeeSectionEditModalProps) {
    return <PersonnelDialog visible={visible} title="Personalakte bearbeiten" form onClose={onClose}><EmployeeEditForm employeeId={employeeId} sectionOnly={section} onCancel={onClose} onUpdated={() => { onUpdated?.(); onClose(); }}/></PersonnelDialog>;
}
