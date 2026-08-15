import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname, useSegments } from 'expo-router';
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
} from '@/lib/navigation/healthosRoutePresentation';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { AutoScrollView } from './AutoScrollView';
import { ScreenHeader } from './ScreenHeader';
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
        centralPopupWorkspace: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'rgba(4,17,37,0.96)',
        },
        centralPopupPageHeader: {
          minHeight: isPhone ? 66 : 84,
          flexShrink: 0,
          paddingHorizontal: isPhone ? spacing.md : spacing.lg,
          paddingVertical: isPhone ? spacing.sm : spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(117,211,255,0.28)',
          backgroundColor: 'rgba(8,29,57,0.93)',
        },
        centralPopupTitleGroup: {
          flex: 1,
          minWidth: 0,
        },
        centralPopupEyebrow: {
          color: '#78DCFF',
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '900',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        },
        centralPopupTitle: {
          color: '#F5FAFF',
          fontSize: isPhone ? 19 : 24,
          lineHeight: isPhone ? 24 : 30,
          fontWeight: '900',
          letterSpacing: -0.4,
          marginTop: 2,
        },
        centralPopupSubtitle: {
          color: '#AFC9E0',
          fontSize: 12,
          lineHeight: 17,
          fontWeight: '600',
          marginTop: 2,
        },
        centralPopupActions: {
          flexShrink: 0,
          alignItems: 'flex-end',
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

  if (contextualPopup) {
    return (
      <SurfaceContrastProvider tone="dark">
        <View
          style={[rootStyle, styles.centralPopupWorkspace]}
          testID="screen-shell-contextual-popup"
          {...(Platform.OS === 'web'
            ? ({ dataSet: { csCentralPopupWorkspace: 'true' } } as object)
            : {})}
        >
          <View
            style={styles.centralPopupPageHeader}
            {...(Platform.OS === 'web'
              ? ({ dataSet: { csCentralPopupPageHeader: 'true' } } as object)
              : {})}
          >
            <View style={styles.centralPopupTitleGroup}>
              <Text style={styles.centralPopupEyebrow}>CareSuite HealthOS</Text>
              <Text numberOfLines={2} style={styles.centralPopupTitle}>{title}</Text>
              {subtitle ? <Text numberOfLines={2} style={styles.centralPopupSubtitle}>{subtitle}</Text> : null}
            </View>
            {effectiveRightSlot ? <View style={styles.centralPopupActions}>{effectiveRightSlot}</View> : null}
          </View>
          <HealthOSPageSurface padded={false}>{body}</HealthOSPageSurface>
        </View>
      </SurfaceContrastProvider>
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
