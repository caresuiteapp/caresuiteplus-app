import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { EmployeeEditForm } from '@/components/office/employeeeditform';
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { employeeSectionEditTitle } from '@/lib/office/employeeSectionEditLabels';

export type EmployeeSectionEditModalProps = {
  visible: boolean;
  employeeId: string;
  section: EmployeeEditSectionKey;
  onClose: () => void;
  onUpdated?: () => void;
  onOpenPersonnelRecord?: () => void;
};

/** Section-specific employee edit — no multi-step wizard. */
export function EmployeeSectionEditModal({
  visible,
  employeeId,
  section,
  onClose,
  onUpdated,
  onOpenPersonnelRecord,
}: EmployeeSectionEditModalProps) {
  const handleUpdated = () => {
    onUpdated?.();
    onClose();
  };

  return (
    <AppGlassModal
      visible={visible}
      title={employeeSectionEditTitle(section)}
      onClose={onClose}
      maxWidth={680}
    >
      <EmployeeEditForm
        employeeId={employeeId}
        sectionOnly={section}
        onCancel={onClose}
        onUpdated={handleUpdated}
        onOpenPersonnelRecord={onOpenPersonnelRecord}
      />
    </AppGlassModal>
  );
}
