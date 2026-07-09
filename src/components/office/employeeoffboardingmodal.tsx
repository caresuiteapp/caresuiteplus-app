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
import { EmployeeOffboardingScreen } from '@/screens/office/EmployeeOffboardingScreen';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing } from '@/theme';

export type EmployeeOffboardingModalProps = {
  visible: boolean;
  employeeId: string | null;
  onClose: () => void;
};

const MODAL_MAX_WIDTH = 920;
const MODAL_MIN_WIDTH = 560;

export function EmployeeOffboardingModal({
  visible,
  employeeId,
  onClose,
}: EmployeeOffboardingModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isDark } = useCareLightPalette();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const officeAccent = moduleColor('office');
  const isBottomSheet = !isDesktop;

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
      isBottomSheet
        ? undefined
        : Math.min(
            screenWidth - spacing.lg * 2,
            Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, screenWidth * 0.92)),
          ),
    [isBottomSheet, screenWidth],
  );

  const sheetMaxHeight = useMemo(
    () =>
      isBottomSheet
        ? screenHeight * 0.92
        : Math.min(screenHeight * 0.9, screenHeight - spacing.lg * 2),
    [isBottomSheet, screenHeight],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: careSuiteModalScrimStrong,
          justifyContent: isBottomSheet ? 'flex-end' : 'center',
          alignItems: 'center',
          padding: isBottomSheet ? 0 : spacing.lg,
        },
        sheetHost: {
          width: isBottomSheet ? ('100%' as const) : sheetWidth,
          maxHeight: sheetMaxHeight,
          flex: isBottomSheet ? undefined : 1,
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
    [isBottomSheet, isDark, sheetMaxHeight, sheetWidth],
  );

  if (!visible || !employeeId) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isBottomSheet ? 'slide' : 'fade'}
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
            <GradientModalHeader title="Offboarding" onClose={onClose} />
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <EmployeeOffboardingScreen employeeId={employeeId} embedded embeddedInModal />
            </ScrollView>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
