import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { EmployeeEditForm } from './employeeeditform.web';
import { PersonnelDialog } from './PersonnelDialog.web';
export type EmployeeSectionEditModalProps = { visible: boolean; employeeId: string; section: EmployeeEditSectionKey; onClose: () => void; onUpdated?: () => void; onOpenPersonnelRecord?: () => void };
export function EmployeeSectionEditModal({ visible, employeeId, section, onClose, onUpdated }: EmployeeSectionEditModalProps) {
  return <PersonnelDialog visible={visible} title="Personalakte bearbeiten" form onClose={onClose}><EmployeeEditForm employeeId={employeeId} sectionOnly={section} onCancel={onClose} onUpdated={() => { onUpdated?.(); onClose(); }} /></PersonnelDialog>;
}
