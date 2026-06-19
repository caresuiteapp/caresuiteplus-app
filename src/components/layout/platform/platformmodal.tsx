import { useEffect, useMemo, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
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
};

const DEFAULT_MAX_WIDTH = 560;
const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MAX_HEIGHT_RATIO = 0.9;

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
}: PlatformModalProps) {
  const { isDark, c } = useCareLightPalette();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const resolvedAnimation = animationType ?? (variant === 'bottomSheet' ? 'slide' : 'fade');
  const accent = glowColor ?? c.violet;

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
          backgroundColor: isDark ? 'rgba(4,8,24,0.72)' : 'rgba(7,18,42,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        },
        backdropBottom: {
          flex: 1,
          backgroundColor: isDark ? 'rgba(4,8,24,0.72)' : 'rgba(7,18,42,0.45)',
          justifyContent: 'flex-end',
        },
        sheetHost: {
          width: sheetWidth,
          maxHeight: sheetMaxHeight,
          ...(variant === 'bottomSheet'
            ? { width: '100%' as const, maxHeight: sheetMaxHeight }
            : {}),
          ...Platform.select({
            web: { boxShadow: '0 24px 64px rgba(0,0,0,0.35)' as unknown as undefined },
            default: {},
          }),
        },
        sheetInner: {
          flexShrink: 1,
          minHeight: 0,
        },
        body: {
          padding: careSpacing.lg,
          gap: careSpacing.sm,
        },
        footer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: careSpacing.sm,
          paddingHorizontal: careSpacing.lg,
          paddingBottom: careSpacing.lg,
        },
      }),
    [c.muted, isDark, sheetMaxHeight, sheetWidth, variant],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !lockBodyScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockBodyScroll, visible]);

  const backdropStyle = variant === 'bottomSheet' ? styles.backdropBottom : styles.backdropCenter;

  const sheetContent = (
    <GlassSurface
      radius={variant === 'bottomSheet' ? careRadius.lg : careRadius.lg}
      glowColor={accent}
      glowOpacity={isDark ? 0.22 : 0.12}
      elevated
      style={[styles.sheetInner, sheetStyle]}
    >
      <GradientModalHeader
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        onClose={onClose}
        actions={headerActions}
      />
      <View style={[styles.body, bodyStyle]}>{children}</View>
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
      onRequestClose={onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <View style={backdropStyle} accessibilityViewIsModal>
        {dismissOnBackdrop ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
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
