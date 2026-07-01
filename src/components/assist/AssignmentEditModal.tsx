import { ScrollView, StyleSheet } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { AssignmentEditForm } from '@/components/assist/AssignmentEditForm';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

type AssignmentEditModalProps = {
  visible: boolean;
  visit: VisitDispositionDetail | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
};

const EDIT_MAX_WIDTH = 960;

/** Modal overlay for editing an assignment from preview/detail without leaving the page. */
export function AssignmentEditModal({
  visible,
  visit,
  onClose,
  onSaved,
}: AssignmentEditModalProps) {
  const assistAccent = moduleColor('assist');

  if (!visit) return null;

  const handleSaved = (id: string) => {
    onSaved?.(id);
    onClose();
  };

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title="Einsatz bearbeiten"
      subtitle="Bezeichnung, Termin, Ort, Status und Katalogfelder"
      maxWidth={EDIT_MAX_WIDTH}
      maxHeightRatio={0.92}
      glowColor={assistAccent}
      bodyStyle={styles.modalBody}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <AssignmentEditForm
          visitId={visit.id}
          initialVisit={visit}
          onCancel={onClose}
          onSaved={handleSaved}
        />
      </ScrollView>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    paddingTop: 0,
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: careSpacing.lg,
  },
});
