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
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius, spacing } from '@/theme';

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
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        sheet: {
          backgroundColor: colors.bgPremium,
          borderRadius: radius.lg,
          overflow: 'hidden',
          ...Platform.select({
            web: { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' as unknown as undefined },
            default: {},
          }),
        },
        body: {
          padding: spacing.lg,
          gap: spacing.sm,
        },
        subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
        canvasSlot: { width: '100%', alignSelf: 'stretch' },
      }),
    [colors, typography],
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
        <View
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              maxHeight: screenHeight * 0.92,
            },
          ]}
        >
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
        </View>
      </View>
    </Modal>
  );
}
