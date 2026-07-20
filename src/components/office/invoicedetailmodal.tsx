import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { InvoiceDetailSummaryPanel } from './InvoiceDetailSummaryPanel';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import { InvoiceDetailScreen } from '@/screens/office/InvoiceDetailScreen';
import { spacing } from '@/theme';

type InvoiceDetailModalProps = {
  visible: boolean;
  invoiceId: string | null;
  onClose: () => void;
};

type ModalMode = 'preview' | 'full';

const PREVIEW_MAX_WIDTH = 920;
const PREVIEW_MIN_WIDTH = 560;
const FULL_MAX_WIDTH = 1280;

export function InvoiceDetailModal({
  visible,
  invoiceId,
  onClose,
}: InvoiceDetailModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isDark } = useCareLightPalette();
  const officeAccent = moduleColor('office');
  const [mode, setMode] = useState<ModalMode>('preview');

  useEffect(() => {
    if (!visible) {
      setMode('preview');
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    setMode('preview');
  }, [invoiceId]);

  const isFull = mode === 'full';

  const sheetWidth = useMemo(() => {
    if (isFull) {
      return Math.min(
        screenWidth - spacing.md * 2,
        Math.max(PREVIEW_MIN_WIDTH, Math.min(FULL_MAX_WIDTH, screenWidth * 0.96)),
      );
    }
    return Math.min(
      screenWidth - spacing.lg * 2,
      Math.max(PREVIEW_MIN_WIDTH, Math.min(PREVIEW_MAX_WIDTH, screenWidth * 0.92)),
    );
  }, [isFull, screenWidth]);

  const sheetMaxHeight = useMemo(
    () =>
      isFull
        ? Math.min(screenHeight * 0.94, screenHeight - spacing.md * 2)
        : Math.min(screenHeight * 0.9, screenHeight - spacing.lg * 2),
    [isFull, screenHeight],
  );

  const handleOpenFullRecord = useCallback(() => {
    setMode('full');
  }, []);

  const handleBackToPreview = useCallback(() => {
    setMode('preview');
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: careSuiteModalScrimStrong,
          justifyContent: 'center',
          alignItems: 'center',
          padding: isFull ? spacing.md : spacing.lg,
        },
        sheetHost: {
          width: sheetWidth,
          maxHeight: sheetMaxHeight,
          flex: isFull ? 1 : undefined,
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
        fullContent: {
          flex: 1,
          minHeight: 0,
        },
      }),
    [isDark, isFull, sheetMaxHeight, sheetWidth],
  );

  if (!invoiceId) return null;

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
            <GradientModalHeader
              title={isFull ? 'Rechnung' : 'Rechnungsvorschau'}
              onBack={isFull ? handleBackToPreview : undefined}
              onClose={onClose}
            />

            {isFull ? (
              <View style={styles.fullContent}>
                <InvoiceDetailScreen invoiceId={invoiceId} embedded />
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <InvoiceDetailSummaryPanel
                  invoiceId={invoiceId}
                  onOpenFullRecord={handleOpenFullRecord}
                />
              </ScrollView>
            )}
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

