import { useState } from 'react';
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
  const [shellActions, setShellActions] = useState<{
    submit: () => Promise<void>;
    submitting: boolean;
  } | null>(null);

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
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: 'Speichern',
          onPress: () => void shellActions?.submit(),
          loading: shellActions?.submitting,
          disabled: !shellActions,
          variant: 'glass',
        },
      ]}
    >
      <EmployeeEditForm
        employeeId={employeeId}
        sectionOnly={section}
        modalShell
        onShellActions={setShellActions}
        onCancel={onClose}
        onUpdated={handleUpdated}
        onOpenPersonnelRecord={onOpenPersonnelRecord}
      />
    </AppGlassModal>
  );
}
