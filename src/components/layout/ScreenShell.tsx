import { ReactNode, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careLightColors } from '@/design/tokens/lightTheme';
import { getBreadcrumbs } from '@/lib/navigation';
import { isAuthRoutePath, isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import {
  MOBILE_AUTH_BOTTOM_RESERVE,
  webSafeAreaCalc,
  webShellViewportLockStyle,
} from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';
import { AutoScrollView } from './AutoScrollView';
import { CareLightPageShell } from './CareLightPageShell';
import { ScreenHeader } from './ScreenHeader';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  /** WP018 — optionale Barrierefreiheits-Metadaten */
  a11yMeta?: DomainA11yMeta;
  /** Portal mobile: Abmelden only in nav drawer, not page header. */
  hideMobileLogout?: boolean;
  /** Extra bottom padding for scroll content under fixed bottom nav. */
  mobileContentPaddingBottom?: number;
};

export function ScreenShell({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  children,
  scroll = true,
  showBreadcrumbs = true,
  a11yMeta,
  hideMobileLogout = false,
  mobileContentPaddingBottom,
}: ScreenShellProps) {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const { isPhone } = useDeviceClass();
  const effectiveRightSlot = hideMobileLogout && isPhone ? undefined : rightSlot;

  if (mode === 'light' && !shellHostsAurora) {
    return (
      <CareLightPageShell
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBack={onBack}
        rightSlot={effectiveRightSlot}
        scroll={scroll}
        showBreadcrumbs={showBreadcrumbs}
        a11yMeta={a11yMeta}
      >
        {children}
      </CareLightPageShell>
    );
  }

  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const breadcrumbTrail =
    showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;
  const isPortalShell = isPortalRoutePath(pathname);
  const isAuthRoute = isAuthRoutePath(pathname);
  const disableMobileInnerScroll = shellHostsAurora && isPhone && isPortalShell;
  const shellScroll = scroll && !disableMobileInnerScroll;
  const useMobileTouchScroll = shellScroll && isPhone && !isPortalShell;
  const authMobileBottomPad =
    isPhone && isAuthRoute
      ? Platform.OS === 'web'
        ? (webSafeAreaCalc('bottom', MOBILE_AUTH_BOTTOM_RESERVE) as number)
        : MOBILE_AUTH_BOTTOM_RESERVE + Math.max(insets.bottom, spacing.sm)
      : (mobileContentPaddingBottom ?? spacing.xxl);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        auroraRoot: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 0,
          backgroundColor: 'transparent',
        },
        safe: {
          flex: 1,
          backgroundColor: shellHostsAurora ? 'transparent' : careLightColors.page,
        },
        scrollView: {
          flex: 1,
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        scrollHost: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        scroll: {
          flexGrow: shellHostsAurora && !(isPhone && isAuthRoute) ? 1 : undefined,
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: authMobileBottomPad,
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        content: {
          flex: 1,
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        contentHost: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: 'transparent',
        },
        a11yRoot: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          backgroundColor: shellHostsAurora ? spatialCare.stage : undefined,
          borderRadius: shellHostsAurora ? spatialCare.radius.stage : 0,
          overflow: 'hidden',
          borderWidth: shellHostsAurora ? 1 : 0,
          borderColor: shellHostsAurora ? spatialCare.border : 'transparent',
          ...(shellHostsAurora && Platform.OS === 'web'
            ? ({ boxShadow: spatialCare.shadowSoft } as unknown as ViewStyle)
            : null),
        },
      }),
    [authMobileBottomPad, isAuthRoute, isPhone, shellHostsAurora],
  );

  const header = (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      breadcrumbTrail={breadcrumbTrail}
      showBack={showBack}
      onBack={onBack}
      rightSlot={effectiveRightSlot}
    />
  );

  const a11yProps = {
    accessible: !!a11yMeta,
    accessibilityRole: a11yMeta?.headingRole,
    accessibilityHint: a11yMeta?.reduceMotionHint,
  } as const;

  if (shellHostsAurora) {
    const body = shellScroll ? (
      useMobileTouchScroll ? (
        <AutoScrollView
          style={styles.scrollHost}
          contentContainerStyle={styles.scroll}
          fillViewport={false}
        >
          {children}
        </AutoScrollView>
      ) : (
        <ScrollView
          style={styles.scrollHost}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      )
    ) : (
      <View style={styles.contentHost}>{children}</View>
    );

    const auroraRootStyle: ViewStyle[] = [styles.auroraRoot];
    if (useMobileTouchScroll && Platform.OS === 'web') {
      auroraRootStyle.push(webShellViewportLockStyle());
    }

    return (
      <View
        style={auroraRootStyle}
        testID="screen-shell"
        accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
      >
        {header}
        <View style={styles.a11yRoot} {...a11yProps}>
          {body}
        </View>
      </View>
    );
  }

  const content = shellScroll ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="screen-shell"
      accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
    >
      {header}
      <View style={styles.a11yRoot} {...a11yProps}>
        {content}
      </View>
    </SafeAreaView>
  );
}
