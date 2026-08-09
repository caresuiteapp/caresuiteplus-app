import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { MOBILE_MIN_TOUCH_TARGET } from '@/lib/platform/webSafeArea';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, typography } from '@/theme';
import { BreadcrumbTrail } from './BreadcrumbTrail';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbTrail?: BreadcrumbTrailType;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  /** Hide breadcrumb trail on phone for compact portal pages. */
  simplifyOnPhone?: boolean;
  /** Dense header for full-height workspaces such as chat and planning. */
  compact?: boolean;
};

export function ScreenHeader({
  title,
  subtitle,
  breadcrumbTrail,
  showBack = true,
  onBack,
  rightSlot,
  simplifyOnPhone = true,
  compact = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const { colors, mode } = useLegacyTheme();
  const showBreadcrumbs = simplifyOnPhone ? !isPhone && breadcrumbTrail : breadcrumbTrail;
  const leftInsetWidth = showBack ? 88 : 0;
  const sideInsetWidth = isPhone
    ? Math.max(leftInsetWidth, rightSlot ? 88 : 0)
    : leftInsetWidth;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: compact ? 6 : spacing.md,
          minHeight: compact ? 54 : isPhone ? 68 : 82,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSoft,
          backgroundColor: colors.bgPanel,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: mode === 'light' ? 'none' : `blur(${spatialCare.blur.navigation}px) saturate(1.25)`,
                WebkitBackdropFilter: mode === 'light' ? 'none' : `blur(${spatialCare.blur.navigation}px) saturate(1.25)`,
              } as unknown as ViewStyle)
            : null),
        },
        left: {
          width: sideInsetWidth,
          minWidth: sideInsetWidth,
        },
        center: {
          flex: 1,
          alignItems: isPhone ? 'center' : 'flex-start',
          minWidth: 0,
        },
        right: {
          width: isPhone ? sideInsetWidth : undefined,
          minWidth: isPhone ? sideInsetWidth : rightSlot ? 120 : 0,
          maxWidth: isPhone ? 88 : 360,
          alignItems: 'flex-end',
          flexShrink: 0,
        },
        backButton: {
          minWidth: MOBILE_MIN_TOUCH_TARGET,
          minHeight: MOBILE_MIN_TOUCH_TARGET,
          justifyContent: 'center',
          paddingVertical: spacing.xs,
        },
        backText: {
          ...typography.caption,
          color: mode === 'light' ? colors.primary : spatialCareColors.cyanLight,
          fontWeight: '700',
        },
        title: {
          ...typography.h3,
          fontSize: compact ? 18 : typography.h3.fontSize,
          lineHeight: compact ? 22 : typography.h3.lineHeight,
          color: colors.textPrimary,
          textAlign: isPhone ? 'center' : 'left',
          flexShrink: 1,
        },
        subtitle: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: isPhone ? 'center' : 'left',
          marginTop: 2,
        },
      }),
    [colors, compact, isPhone, mode, rightSlot, sideInsetWidth],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as never);
  };

  return (
    <View
      accessibilityRole="header"
      style={styles.container}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'screen-header' } } as object)
        : {})}
    >
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <Text style={styles.backText}>← Zurück</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        {showBreadcrumbs ? <BreadcrumbTrail trail={breadcrumbTrail!} /> : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
}
