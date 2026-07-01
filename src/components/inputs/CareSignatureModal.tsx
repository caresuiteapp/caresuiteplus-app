import { useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CareSignatureCanvas } from '@/components/inputs/CareSignatureCanvas';
import { OrientationGate } from '@/components/layout/OrientationGate';
import { GradientModalHeader } from '@/components/layout/platform';
import { FullscreenOverlay } from '@/components/ui/FullscreenOverlay';
import { GlassSurface } from '@/components/ui/effects';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { resolveCareTypography } from '@/design/tokens/typography';
import { legacyColorsFromPalette, useLegacyTheme } from '@/design/tokens/themeBridge';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useOrientation } from '@/hooks/useOrientation';
import { spacing } from '@/theme';

const DESKTOP_MIN_WIDTH = 600;
const DESKTOP_CANVAS_HEIGHT = 320;
const MOBILE_WIDTH_RATIO = 0.92;

type Props = {
  visible: boolean;
  label: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
  disabled?: boolean;
  /** sessionStorage scope for landscape dismiss — typically visitId. */
  dismissScope?: string;
};

export function CareSignatureModal({
  visible,
  label,
  onConfirm,
  onClose,
  disabled,
  dismissScope = 'signature',
}: Props) {
  const { colors, typography, isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const lightModal = isLight && auroraActive;
  const safeColors = colors ?? legacyColorsFromPalette('dark');
  const safeTypography = typography ?? resolveCareTypography('dark');
  const { isPhone, isTablet } = useDeviceClass();
  const orientation = useOrientation();
  const fullscreen = isPhone || isTablet;
  const portraitMobile = fullscreen && !orientation.isLandscape;
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
        fullscreenRoot: {
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          backgroundColor: '#fff',
          ...Platform.select({
            web: {
              overscrollBehavior: 'contain',
              touchAction: 'none',
            },
            default: {},
          }),
        },
        fullscreenBody: {
          flex: 1,
          minHeight: 0,
          paddingHorizontal: portraitMobile ? spacing.xs : spacing.sm,
          paddingTop: spacing.xs,
        },
        sheetHost: {
          overflow: 'hidden',
        },
        body: {
          padding: spacing.lg,
          gap: spacing.sm,
        },
        subtitle: {
          ...safeTypography.caption,
          color: safeColors.textMuted,
          marginBottom: spacing.xs,
        },
        canvasSlot: {
          width: '100%',
          alignSelf: 'stretch',
          flex: 1,
          minHeight: 0,
        },
      }),
    [lightModal, portraitMobile, safeColors, safeTypography],
  );

  const sheetWidth = useMemo(
    () =>
      Math.min(
        screenWidth - spacing.lg * 2,
        Math.max(DESKTOP_MIN_WIDTH, screenWidth * MOBILE_WIDTH_RATIO),
      ),
    [screenWidth],
  );

  const desktopCanvasHeight = Math.max(DESKTOP_CANVAS_HEIGHT, 200);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || fullscreen) return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.body.style.touchAction = 'none';

    const blockTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    document.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
      document.removeEventListener('touchmove', blockTouchMove);
    };
  }, [fullscreen, visible]);

  const handleConfirm = useCallback(
    (dataUrl: string) => {
      onConfirm(dataUrl);
      onClose();
    },
    [onClose, onConfirm],
  );

  const canvas = (
    <CareSignatureCanvas
      size="large"
      height={fullscreen ? undefined : desktopCanvasHeight}
      fillAvailable={fullscreen}
      actionLayout={fullscreen ? 'bar' : 'default'}
      onConfirm={handleConfirm}
      onCancel={onClose}
      disabled={disabled}
      showLabel={false}
    />
  );

  if (fullscreen) {
    if (!visible) return null;

    return (
      <FullscreenOverlay visible onRequestClose={onClose} testID="signature-fullscreen-overlay">
        <OrientationGate
          screenKey="signature"
          active={visible}
          options={{ autoLock: true, dismissScope }}
        >
          <View
            style={[styles.fullscreenRoot, { paddingTop: insets.top }]}
            pointerEvents="box-none"
          >
            <GradientModalHeader title="Unterschrift" subtitle={label} onClose={onClose} />
            <View style={styles.fullscreenBody} pointerEvents="box-none">
              <View style={styles.canvasSlot}>{canvas}</View>
            </View>
          </View>
        </OrientationGate>
      </FullscreenOverlay>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={[styles.sheetHost, { width: sheetWidth, maxHeight: screenHeight * 0.92 }]}>
          <GlassSurface radius={careRadius.lg} elevated style={{ overflow: 'hidden' }}>
            <GradientModalHeader title="Unterschrift" onClose={onClose} />
            <View style={styles.body}>
              <Text style={styles.subtitle}>{label}</Text>
              <View style={styles.canvasSlot}>{canvas}</View>
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
