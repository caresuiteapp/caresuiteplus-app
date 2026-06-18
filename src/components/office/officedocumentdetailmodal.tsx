import { useEffect, useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { OfficeDocumentDetailSummaryPanel } from './OfficeDocumentDetailSummaryPanel';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import { spacing } from '@/theme';

type OfficeDocumentDetailModalProps = {
  visible: boolean;
  documentId: string | null;
  onClose: () => void;
};

const PREVIEW_MAX_WIDTH = 920;
const PREVIEW_MIN_WIDTH = 560;

export function OfficeDocumentDetailModal({
  visible,
  documentId,
  onClose,
}: OfficeDocumentDetailModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isDark } = useCareLightPalette();
  const officeAccent = moduleColor('office');

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const sheetWidth = useMemo(
    () =>
      Math.min(
        screenWidth - spacing.lg * 2,
        Math.max(PREVIEW_MIN_WIDTH, Math.min(PREVIEW_MAX_WIDTH, screenWidth * 0.92)),
      ),
    [screenWidth],
  );

  const sheetMaxHeight = useMemo(
    () => Math.min(screenHeight * 0.9, screenHeight - spacing.lg * 2),
    [screenHeight],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: isDark ? 'rgba(4,8,24,0.72)' : 'rgba(7,18,42,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        sheetHost: {
          width: sheetWidth,
          maxHeight: sheetMaxHeight,
          ...Platform.select({
            web: { boxShadow: '0 24px 64px rgba(0,0,0,0.35)' as unknown as undefined },
            default: {},
          }),
        },
        sheetInner: {
          flex: 1,
          minHeight: 0,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          flexGrow: 1,
        },
      }),
    [isDark, sheetMaxHeight, sheetWidth],
  );

  if (!documentId) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <GlassSurface
            radius={careRadius.lg}
            glowColor={officeAccent}
            glowOpacity={isDark ? 0.22 : 0.12}
            elevated
            style={styles.sheetInner}
          >
            <GradientModalHeader title="Dokument" onClose={onClose} />
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <OfficeDocumentDetailSummaryPanel documentId={documentId} />
            </ScrollView>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
