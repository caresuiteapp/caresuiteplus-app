import { EmployeeCreateForm } from './employeecreateform.web';
import { PersonnelDialog } from './PersonnelDialog.web';
export type EmployeeCreateModalProps = { visible: boolean; onClose: () => void; onCreated?: (employeeId: string) => void };
export function EmployeeCreateModal({ visible, onClose, onCreated }: EmployeeCreateModalProps) {
  return <PersonnelDialog visible={visible} title="Mitarbeitende anlegen" form onClose={onClose}><EmployeeCreateForm onCancel={onClose} onCreated={id => { if (onCreated) onCreated(id); else onClose(); }} /></PersonnelDialog>;
}
