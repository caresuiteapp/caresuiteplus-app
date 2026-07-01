import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel';
import { AssignmentEditModal } from '@/components/assist/AssignmentEditModal';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { useAuroraGlassModalStyle } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

type AssignmentDetailGlassModalProps = {
  visible: boolean;
  assignmentId: string | null;
  title?: string;
  onClose: () => void;
  onDeleted?: () => void;
};

type ModalMode = 'preview' | 'full';

const PREVIEW_MAX_WIDTH = 920;
const FULL_MAX_WIDTH = 1280;
const FORM_CTX = { viewContext: 'form' as const };

export function AssignmentDetailGlassModal({
  visible,
  assignmentId,
  title,
  onClose,
  onDeleted,
}: AssignmentDetailGlassModalProps) {
  const assistAccent = moduleColor('assist');
  const formPanelStyle = useAuroraGlassModalStyle(FORM_CTX);
  const [mode, setMode] = useState<ModalMode>('preview');
  const [editVisit, setEditVisit] = useState<VisitDispositionDetail | null>(null);
  const [detailRefreshTrigger, setDetailRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!visible) {
      setMode('preview');
      setEditVisit(null);
    }
  }, [visible]);

  useEffect(() => {
    setMode('preview');
    setEditVisit(null);
  }, [assignmentId]);

  const handleEdit = useCallback((visit: VisitDispositionDetail) => {
    setEditVisit(visit);
  }, []);

  const handleEditSaved = useCallback(() => {
    setDetailRefreshTrigger((n) => n + 1);
  }, []);

  if (!assignmentId) return null;

  const isFull = mode === 'full';

  const handleDeleted = () => {
    onDeleted?.();
    onClose();
  };

  return (
    <>
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
        <View style={styles.shell}>
          <View style={[styles.detailPanel, formPanelStyle]}>
            <AssignmentDetailTabsPanel
              assignmentId={assignmentId}
              mode={isFull ? 'full' : 'preview'}
              layout="modal"
              onOpenFullRecord={() => setMode('full')}
              onEdit={handleEdit}
              refreshTrigger={detailRefreshTrigger}
              onClose={onClose}
              onDeleted={handleDeleted}
            />
          </View>
        </View>
      </PlatformModal>

      <AssignmentEditModal
        visible={Boolean(editVisit)}
        visit={editVisit}
        onClose={() => setEditVisit(null)}
        onSaved={handleEditSaved}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    paddingTop: 0,
    gap: 0,
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        overflow: 'hidden' as const,
      },
      default: {},
    }),
  },
  shell: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  detailPanel: {
    borderRadius: careRadius.lg,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
});
