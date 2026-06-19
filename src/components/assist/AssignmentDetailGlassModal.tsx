import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';

type AssignmentDetailGlassModalProps = {
  visible: boolean;
  assignmentId: string | null;
  title?: string;
  onClose: () => void;
};

type ModalMode = 'preview' | 'full';

const PREVIEW_MAX_WIDTH = 920;
const FULL_MAX_WIDTH = 1280;

export function AssignmentDetailGlassModal({
  visible,
  assignmentId,
  title,
  onClose,
}: AssignmentDetailGlassModalProps) {
  const assistAccent = moduleColor('assist');
  const [mode, setMode] = useState<ModalMode>('preview');

  useEffect(() => {
    if (!visible) setMode('preview');
  }, [visible]);

  useEffect(() => {
    setMode('preview');
  }, [assignmentId]);

  if (!assignmentId) return null;

  const isFull = mode === 'full';

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title={isFull ? 'Einsatz — Assist-Disposition' : (title ?? 'Einsatzvorschau')}
      subtitle={isFull ? 'Disposition · Planung · Nachweis' : 'Vorschau mit Budget & Status'}
      onBack={isFull ? () => setMode('preview') : undefined}
      maxWidth={isFull ? FULL_MAX_WIDTH : PREVIEW_MAX_WIDTH}
      maxHeightRatio={isFull ? 0.94 : 0.9}
      glowColor={assistAccent}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
        <ScrollView
          style={[styles.scroll, isFull ? styles.scrollFull : null]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailPanel}>
            <AssignmentDetailTabsPanel
              assignmentId={assignmentId}
              mode={isFull ? 'full' : 'preview'}
              onOpenFullRecord={() => setMode('full')}
              onClose={onClose}
            />
          </View>
        </ScrollView>
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: { paddingTop: 0, gap: 0, backgroundColor: auroraGlass.modal },
  body: { gap: careSpacing.md },
  scroll: { flexGrow: 0, maxHeight: 560 },
  scrollFull: { maxHeight: 720 },
  scrollContent: { flexGrow: 1 },
  detailPanel: {
    backgroundColor: auroraGlass.modal,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: auroraGlass.borderStrong,
    overflow: 'hidden',
  },
});
