import { useEffect, useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CareSignatureCanvas } from '@/components/inputs/CareSignatureCanvas';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { resolveCareTypography } from '@/design/tokens/typography';
import { legacyColorsFromPalette, useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

const DESKTOP_MIN_WIDTH = 600;
const DESKTOP_CANVAS_HEIGHT = 320;
const MOBILE_WIDTH_RATIO = 0.92;
const MOBILE_HEIGHT_RATIO = 0.48;

type Props = {
  visible: boolean;
  label: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
  disabled?: boolean;
};

export function CareSignatureModal({ visible, label, onConfirm, onClose, disabled }: Props) {
  const { colors, typography, isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const lightModal = isLight && auroraActive;
  const safeColors = colors ?? legacyColorsFromPalette('dark');
  const safeTypography = typography ?? resolveCareTypography('dark');
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: lightModal ? 'rgba(15, 27, 51, 0.16)' : 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        sheetHost: {
          overflow: 'hidden',
        },
        body: {
          padding: spacing.lg,
          gap: spacing.sm,
        },
        subtitle: { ...safeTypography.caption, color: safeColors.textMuted, marginBottom: spacing.xs },
        canvasSlot: { width: '100%', alignSelf: 'stretch' },
      }),
    [lightModal, safeColors, safeTypography],
  );
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const sheetWidth = useMemo(
    () =>
      Math.min(
        screenWidth - spacing.lg * 2,
        Math.max(DESKTOP_MIN_WIDTH, screenWidth * MOBILE_WIDTH_RATIO),
      ),
    [screenWidth],
  );

  const canvasSize = useMemo(() => {
    const isWide = screenWidth >= 768;
    const canvasHeight = isWide
      ? DESKTOP_CANVAS_HEIGHT
      : Math.floor(Math.min(screenHeight * MOBILE_HEIGHT_RATIO, 360));
    return { canvasHeight: Math.max(canvasHeight, 200) };
  }, [screenWidth, screenHeight]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const handleConfirm = (dataUrl: string) => {
    onConfirm(dataUrl);
    onClose();
  };

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
        <View style={[styles.sheetHost, { width: sheetWidth, maxHeight: screenHeight * 0.92 }]}>
          <GlassSurface radius={careRadius.lg} elevated style={{ overflow: 'hidden' }}>
            <GradientModalHeader title="Unterschrift" onClose={onClose} />
            <View style={styles.body}>
              <Text style={styles.subtitle}>{label}</Text>
              <View style={styles.canvasSlot}>
                <CareSignatureCanvas
                  size="large"
                  height={canvasSize.canvasHeight}
                  onConfirm={handleConfirm}
                  onCancel={onClose}
                  disabled={disabled}
                  showLabel={false}
                />
              </View>
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
