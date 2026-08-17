import { useEffect, useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { ClientIntakeWizardForm } from './clientintakewizardform';
import type { ClientIntakeWizardMode } from '@/hooks/useClientIntakeWizard';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { moduleColor } from '@/design/tokens/modules';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing } from '@/theme';

export type ClientIntakeModalProps = {
  visible: boolean;
  onClose: () => void;
  mode?: ClientIntakeWizardMode;
  clientId?: string;
  onCreated?: (clientId: string) => void;
  onUpdated?: (clientId: string) => void;
};

const MODAL_MAX_WIDTH = 1680;
const MODAL_MIN_WIDTH = 320;
const DESKTOP_MODAL_SIZE_RATIO = 0.96;

export function ClientIntakeModal({
  visible,
  onClose,
  mode = 'create',
  clientId,
  onCreated,
  onUpdated,
}: ClientIntakeModalProps) {
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
            screenWidth - spacing.md * 2,
            Math.max(
              MODAL_MIN_WIDTH,
              Math.min(MODAL_MAX_WIDTH, screenWidth * DESKTOP_MODAL_SIZE_RATIO),
            ),
          ),
    [isBottomSheet, screenWidth],
  );

  const sheetMaxHeight = useMemo(
    () =>
      isBottomSheet
        ? screenHeight * 0.92
        : Math.min(
            screenHeight * DESKTOP_MODAL_SIZE_RATIO,
            screenHeight - spacing.md * 2,
          ),
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
          padding: isBottomSheet ? 0 : spacing.md,
        },
        sheetHost: {
          width: isBottomSheet ? ('100%' as const) : sheetWidth,
          maxHeight: sheetMaxHeight,
          flex: isBottomSheet ? undefined : 1,
          ...Platform.select({
            web: ({ boxShadow: '0 28px 86px rgba(0,0,0,0.56)' } as unknown as undefined),
            default: {},
          }),
        },
        sheetInner: {
          flex: 1,
          minHeight: 0,
        },
      }),
    [isBottomSheet, sheetMaxHeight, sheetWidth],
  );

  const isEditMode = mode === 'edit' && !!clientId;

  const handleCreated = (id: string) => {
    onCreated?.(id);
    onClose();
  };

  const handleUpdated = (id: string) => {
    onUpdated?.(id);
    onClose();
  };

  if (!visible) return null;

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
            <GradientModalHeader
              title={isEditMode ? 'Stammdaten bearbeiten' : 'Klient:in anlegen'}
              onClose={onClose}
            />
            <ClientIntakeWizardForm
              mode={mode}
              clientId={clientId}
              onCancel={onClose}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
              showHero={false}
            />
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}
