import { useEffect, useMemo, useCallback, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { confirmAction } from '@/lib/platform/confirmAction';
import { GlassSurface } from '@/components/ui/effects';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { resolveLlganViewGlass } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careEffects } from '@/design/tokens/effects';
import {
  popupShellLayout,
  resolvePopupShellColors,
} from '@/design/tokens/popupShell';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { spacing } from '@/theme';
import { GradientModalActionButton } from './gradientmodalactionbutton';
import type { GradientModalActionButtonVariant } from './gradientmodalactionbutton';
import { GradientModalHeader } from './gradientmodalheader';

export type PlatformModalAction = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: GradientModalActionButtonVariant;
};

export type PlatformModalVariant = 'center' | 'bottomSheet';

export type PlatformModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onBack?: () => void;
  headerActions?: ReactNode;
  footerActions?: PlatformModalAction[];
  children: ReactNode;
  variant?: PlatformModalVariant;
  animationType?: 'fade' | 'slide' | 'none';
  maxWidth?: number;
  minWidth?: number;
  maxHeightRatio?: number;
  glowColor?: string;
  subtitle?: string;
  dismissOnBackdrop?: boolean;
  statusBarTranslucent?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  lockBodyScroll?: boolean;
  isDirty?: boolean;
  dirtyCloseMessage?: string;
};

const DEFAULT_MAX_WIDTH = popupShellLayout.maxWidthDefault;
const DEFAULT_MIN_WIDTH = popupShellLayout.minWidthDefault;
const DEFAULT_MAX_HEIGHT_RATIO = popupShellLayout.maxHeightRatioDefault;

export function PlatformModal({
  visible,
  title,
  onClose,
  onBack,
  headerActions,
  footerActions,
  children,
  variant = 'center',
  animationType,
  maxWidth = DEFAULT_MAX_WIDTH,
  minWidth = DEFAULT_MIN_WIDTH,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  glowColor,
  subtitle,
  dismissOnBackdrop = true,
  statusBarTranslucent = true,
  bodyStyle,
  sheetStyle,
  lockBodyScroll = true,
  isDirty = false,
  dirtyCloseMessage = 'Ungespeicherte Änderungen verwerfen?',
}: PlatformModalProps) {
  const { isDark, c } = useCareLightPalette();
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const lightModal = isLight && auroraActive;
  const formGlass = resolveLlganViewGlass('form', 'default');
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const resolvedAnimation = animationType ?? (variant === 'bottomSheet' ? 'slide' : 'fade');
  const accent = glowColor ?? c.violet;
  const shellMode = isDark ? 'dark' : 'light';
  const shellColors = resolvePopupShellColors(shellMode);
  const shellRadius = popupShellLayout.borderRadius;

  const sheetWidth = useMemo(() => {
    if (variant === 'bottomSheet') return undefined;
    const horizontalPad = spacing.lg * 2;
    return Math.min(
      screenWidth - horizontalPad,
      Math.max(minWidth, Math.min(maxWidth, screenWidth * 0.92)),
    );
  }, [maxWidth, minWidth, screenWidth, variant]);

  const sheetMaxHeight = useMemo(
    () =>
      variant === 'bottomSheet'
        ? screenHeight * 0.78
        : Math.min(screenHeight * maxHeightRatio, screenHeight - spacing.lg * 2),
    [maxHeightRatio, screenHeight, variant],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdropCenter: {
          flex: 1,
          backgroundColor: lightModal
            ? shellColors.backdrop
            : isDark
              ? careEffects.glass.overlayDark
              : careEffects.glass.overlayLight,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        backdropBottom: {
          flex: 1,
          backgroundColor: lightModal
            ? shellColors.backdrop
            : isDark
              ? careEffects.glass.overlayDark
              : careEffects.glass.overlayLight,
          justifyContent: 'flex-end',
        },
        sheetHost: {
          width: sheetWidth,
          maxHeight: sheetMaxHeight,
          ...(variant === 'bottomSheet'
            ? { width: '100%' as const, maxHeight: sheetMaxHeight }
            : {}),
          ...Platform.select({
            web: lightModal
              ? ({
                  boxShadow: `${formGlass.shadow}, ${popupShellLayout.shadowWebLight}`,
                } as unknown as ViewStyle)
              : ({
                  boxShadow: popupShellLayout.shadowWebDark,
                } as unknown as ViewStyle),
            default: {},
          }),
        },
        sheetInner: {
          flexShrink: 1,
          minHeight: 0,
          maxHeight: sheetMaxHeight,
          flexDirection: 'column',
          overflow: 'hidden',
        },
        bodyScroll: {
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
        },
        body: {
          padding: careSpacing.lg,
          gap: careSpacing.sm,
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
          backgroundColor: lightModal ? shellColors.body.background : undefined,
          ...Platform.select({
            web: {
              overflowY: 'auto' as const,
              overflowX: 'hidden' as const,
            },
            default: {},
          }),
        },
        footer: {
          flexShrink: 0,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: careSpacing.sm,
          paddingHorizontal: careSpacing.lg,
          paddingBottom: careSpacing.lg,
          paddingTop: careSpacing.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: lightModal
            ? shellColors.footerBorder
            : isDark
              ? shellColors.footerBorder
              : 'rgba(0,0,0,0.06)',
        },
      }),
    [formGlass.shadow, isDark, lightModal, shellColors, shellMode, sheetMaxHeight, sheetWidth, variant],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !lockBodyScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockBodyScroll, visible]);

  const requestClose = useCallback(async () => {
    if (isDirty) {
      const confirmed = await confirmAction({
        title: 'Schließen',
        message: dirtyCloseMessage,
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
      });
      if (!confirmed) return;
    }
    onClose();
  }, [dirtyCloseMessage, isDirty, onClose]);

  const handleBack = onBack
    ? async () => {
        if (isDirty) {
          const confirmed = await confirmAction({
            title: 'Zurück',
            message: dirtyCloseMessage,
            confirmLabel: 'Verwerfen',
            cancelLabel: 'Weiter bearbeiten',
          });
          if (!confirmed) return;
        }
        onBack();
      }
    : undefined;

  const backdropStyle = variant === 'bottomSheet' ? styles.backdropBottom : styles.backdropCenter;

  const sheetContent = (
    <GlassSurface
      radius={variant === 'bottomSheet' ? careRadius.lg : shellRadius}
      glowColor={accent}
      glowOpacity={isDark ? 0.22 : 0.12}
      elevated
      style={StyleSheet.flatten([styles.sheetInner, sheetStyle])}
    >
      <View style={{ flexShrink: 0 }}>
        <GradientModalHeader
          title={title}
          subtitle={subtitle}
          onBack={handleBack}
          onClose={() => void requestClose()}
          actions={headerActions}
        />
      </View>
      {Platform.OS === 'web' ? (
        <View style={[styles.body, bodyStyle]}>{children}</View>
      ) : (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={[styles.body, bodyStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      )}
      {footerActions && footerActions.length > 0 ? (
        <View style={styles.footer}>
          {footerActions.map((action) => (
            <GradientModalActionButton
              key={action.title}
              title={action.title}
              onPress={action.onPress}
              loading={action.loading}
              disabled={action.disabled}
              variant={action.variant ?? 'glass'}
            />
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={resolvedAnimation}
      onRequestClose={() => void requestClose()}
      statusBarTranslucent={statusBarTranslucent}
    >
      <View style={backdropStyle} accessibilityViewIsModal>
        {dismissOnBackdrop ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => void requestClose()}
            accessibilityLabel="Schließen"
          />
        ) : null}
        <View
          style={styles.sheetHost}
          pointerEvents="box-none"
          {...(variant === 'bottomSheet'
            ? {}
            : { onStartShouldSetResponder: () => true })}
        >
          {variant === 'bottomSheet' ? (
            <Pressable onPress={(e) => e.stopPropagation()}>{sheetContent}</Pressable>
          ) : (
            sheetContent
          )}
        </View>
      </View>
    </Modal>
  );
}
