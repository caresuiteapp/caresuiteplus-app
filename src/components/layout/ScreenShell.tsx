import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBreadcrumbs } from '@/lib/navigation';
import { isAuthRoutePath, isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import {
  MOBILE_AUTH_BOTTOM_RESERVE,
  webSafeAreaCalc,
  webShellViewportLockStyle,
} from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';
import {
  isHealthOSContextualPopupRoute,
  resolveHealthOSPopupFallbackPath,
} from '@/lib/navigation/healthosRoutePresentation';
import { AutoScrollView } from './AutoScrollView';
import { ScreenHeader } from './ScreenHeader';
import { PlatformModal } from './platform/platformmodal';
import { HealthOSPageSurface, HealthOSPageZone } from './HealthOSPageSurface';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  tabsSlot?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  a11yMeta?: DomainA11yMeta;
  hideMobileLogout?: boolean;
  mobileContentPaddingBottom?: number;
  compactHeader?: boolean;
};

/** Verbindliche Seitenschale für alle Module und Portale. */
export function ScreenShell({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  actionsSlot,
  filtersSlot,
  tabsSlot,
  children,
  scroll = true,
  showBreadcrumbs = true,
  a11yMeta,
  hideMobileLogout = false,
  mobileContentPaddingBottom,
  compactHeader = false,
}: ScreenShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const effectiveRightSlot = hideMobileLogout && isPhone ? undefined : rightSlot;
  const breadcrumbTrail = showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;
  const isPortalShell = isPortalRoutePath(pathname);
  const isAuthRoute = isAuthRoutePath(pathname);
  const contextualPopup = isHealthOSContextualPopupRoute(`/${segments.join('/')}`);
  const shellScroll = scroll && !(isPhone && isPortalShell);
  const useMobileTouchScroll = shellScroll && isPhone && !isPortalShell;
  const bottomPad =
    isPhone && isAuthRoute
      ? Platform.OS === 'web'
        ? (webSafeAreaCalc('bottom', MOBILE_AUTH_BOTTOM_RESERVE) as number)
        : MOBILE_AUTH_BOTTOM_RESERVE + Math.max(insets.bottom, spacing.sm)
      : (mobileContentPaddingBottom ?? spacing.xxl);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 0,
          backgroundColor: 'transparent',
        },
        scrollHost: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          backgroundColor: 'transparent',
        },
        scrollContent: {
          flexGrow: isPhone && isAuthRoute ? undefined : 1,
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: bottomPad,
          backgroundColor: 'transparent',
        },
        content: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: 'transparent',
        },
        popupBody: {
          width: '100%',
          gap: spacing.md,
        },
      }),
    [bottomPad, isAuthRoute, isPhone],
  );

  const structuredContent = (
    <>
      <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
      <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
      <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
      <HealthOSPageZone kind="content">{children}</HealthOSPageZone>
    </>
  );

  const body = shellScroll ? (
    useMobileTouchScroll ? (
      <AutoScrollView style={styles.scrollHost} contentContainerStyle={styles.scrollContent} fillViewport={false}>
        {structuredContent}
      </AutoScrollView>
    ) : (
      <ScrollView
        style={styles.scrollHost}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {structuredContent}
      </ScrollView>
    )
  ) : (
    <View style={styles.content}>{structuredContent}</View>
  );

  const rootStyle: ViewStyle[] = [styles.root];
  if (useMobileTouchScroll && Platform.OS === 'web') rootStyle.push(webShellViewportLockStyle());

  const closeContextualPopup = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(resolveHealthOSPopupFallbackPath(pathname) as never);
  };

  if (contextualPopup) {
    return (
      <View style={rootStyle} testID="screen-shell-contextual-popup">
        <PlatformModal
          visible
          title={title}
          subtitle={subtitle}
          onClose={closeContextualPopup}
          headerActions={effectiveRightSlot}
          maxWidth={1180}
          minWidth={320}
          maxHeightRatio={0.94}
          bodyStyle={styles.popupBody}
        >
          {structuredContent}
        </PlatformModal>
      </View>
    );
  }

  return (
    <View
      style={rootStyle}
      testID="screen-shell"
      accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        breadcrumbTrail={breadcrumbTrail}
        showBack={showBack}
        onBack={onBack}
        rightSlot={effectiveRightSlot}
        compact={compactHeader}
      />
      <HealthOSPageSurface
        padded={false}
        accessible={!!a11yMeta}
        accessibilityRole={a11yMeta?.headingRole}
        accessibilityHint={a11yMeta?.reduceMotionHint}
      >
        {body}
      </HealthOSPageSurface>
    </View>
  );
}
