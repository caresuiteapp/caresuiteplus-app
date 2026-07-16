import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useInteractiveTextColor } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { MOBILE_MIN_TOUCH_TARGET } from '@/lib/platform/webSafeArea';
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
};

export function ScreenHeader({
  title,
  subtitle,
  breadcrumbTrail,
  showBack = true,
  onBack,
  rightSlot,
  simplifyOnPhone = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useLegacyTheme();
  const { isPhone, isDesktopOrWide } = useDeviceClass();
  const hideDesktopPageDescription = isDesktopOrWide;
  const backLinkColor = useInteractiveTextColor();
  const shellHostsAurora = useShellHostsAurora();
  const showBreadcrumbs = simplifyOnPhone ? !isPhone && breadcrumbTrail : breadcrumbTrail;
  const sideInsetWidth = showBack || rightSlot ? 88 : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: shellHostsAurora ? 0 : 1,
          borderBottomColor: colors.borderSoft,
          backgroundColor: shellHostsAurora ? 'transparent' : colors.bgPremium,
        },
        desktopA11yHeader: {
          width: 0,
          height: 0,
          overflow: 'hidden',
        },
        visuallyHidden: {
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          overflow: 'hidden',
          opacity: 0,
        },
        left: {
          width: sideInsetWidth,
          minWidth: sideInsetWidth,
        },
        center: {
          flex: 1,
          alignItems: 'center',
          minWidth: 0,
        },
        right: {
          width: sideInsetWidth,
          minWidth: sideInsetWidth,
          maxWidth: sideInsetWidth || 120,
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
          color: backLinkColor,
          fontWeight: '600',
        },
        title: {
          ...typography.h3,
          color: colors.textPrimary,
          textAlign: 'center',
          flexShrink: 1,
        },
        subtitle: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 2,
        },
      }),
    [backLinkColor, colors, shellHostsAurora, sideInsetWidth],
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
    <View style={hideDesktopPageDescription ? styles.desktopA11yHeader : styles.container}>
      {hideDesktopPageDescription ? (
        <Text accessibilityRole="header" style={styles.visuallyHidden}>{title}</Text>
      ) : null}
      {!hideDesktopPageDescription ? <>
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
      </> : null}
    </View>
  );
}
