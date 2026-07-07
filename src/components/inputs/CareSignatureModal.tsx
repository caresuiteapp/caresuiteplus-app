import { useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
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
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { resolveCareTypography } from '@/design/tokens/typography';
import { legacyColorsFromPalette, useLegacyTheme } from '@/design/tokens/themeBridge';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useOrientation } from '@/hooks/useOrientation';
import { blockDocumentTouchScrollOutsideSignatureCapture } from '@/lib/dom/signatureCaptureScrollLock';
import { spacing, typography } from '@/theme';

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

function PlainSignatureHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <View style={plainHeaderStyles.root}>
      <View style={plainHeaderStyles.leading}>
        <Text style={plainHeaderStyles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={plainHeaderStyles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onClose}
        style={plainHeaderStyles.close}
        accessibilityRole="button"
        accessibilityLabel="Schließen"
      >
        <Text style={plainHeaderStyles.closeLabel}>×</Text>
      </Pressable>
    </View>
  );
}

const plainHeaderStyles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: careLightColors.border,
    backgroundColor: careLightColors.surface,
  },
  leading: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.h3, color: careLightColors.text },
  subtitle: { ...typography.caption, color: careLightColors.muted },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: careLightColors.border,
    backgroundColor: careLightColors.page,
  },
  closeLabel: { fontSize: 22, lineHeight: 24, color: careLightColors.text },
});

export function CareSignatureModal({
  visible,
  label,
  onConfirm,
  onClose,
  disabled,
  dismissScope = 'signature',
}: Props) {
  const { colors, typography: themeTypography, isLight } = useLegacyTheme();
  const safeColors = colors ?? legacyColorsFromPalette('dark');
  const safeTypography = themeTypography ?? resolveCareTypography('dark');
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
          backgroundColor: 'rgba(15, 27, 51, 0.35)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        fullscreenHeader: {
          flexShrink: 0,
        },
        fullscreenRoot: {
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          backgroundColor: '#fff',
          ...Platform.select({
            web: {
              height: '100%',
              overscrollBehavior: 'contain',
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
          borderRadius: careRadius.lg,
          backgroundColor: careLightColors.surface,
          borderWidth: 1,
          borderColor: careLightColors.border,
        },
        body: {
          padding: spacing.lg,
          gap: spacing.sm,
          backgroundColor: careLightColors.surface,
        },
        subtitle: {
          ...safeTypography.caption,
          color: careLightColors.muted,
          marginBottom: spacing.xs,
        },
        canvasSlot: {
          width: '100%',
          alignSelf: 'stretch',
          flex: 1,
          minHeight: 0,
        },
      }),
    [portraitMobile, safeTypography],
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
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    const blockTouchMove = blockDocumentTouchScrollOutsideSignatureCapture;
    document.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
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
      <FullscreenOverlay visible={visible} onRequestClose={onClose} testID="signature-fullscreen-overlay">
        <OrientationGate
          screenKey="signature"
          active={visible}
          options={{ autoLock: true, dismissScope }}
        >
          <View
            style={[
              styles.fullscreenRoot,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.fullscreenHeader}>
              <PlainSignatureHeader title="Unterschrift" subtitle={label} onClose={onClose} />
            </View>
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
          <GradientModalHeader title="Unterschrift" onClose={onClose} />
          <View style={styles.body}>
            <Text style={styles.subtitle}>{label}</Text>
            <View style={styles.canvasSlot}>{canvas}</View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
