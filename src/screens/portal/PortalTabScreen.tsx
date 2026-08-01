import { ReactNode, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMobileTabHeader } from '@/components/portal/PortalMobileTabHeader';
import { ScreenShell } from '@/components/layout';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import { usePathname } from 'expo-router';
import { EmployeePortalPageFrame } from '@/components/portal/EmployeePortalPageFrame';
import { ClientPortalPageFrame } from '@/components/portal/ClientPortalPageFrame';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import {
  resolvePortalMobileContentPaddingBottom,
  webSafeAreaCalc,
} from '@/lib/platform/webSafeArea';
import { spacing } from '@/theme';

type PortalTabScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  /** On phone: skip duplicate page header — hero or section title carries context. */
  hideHeaderOnPhone?: boolean;
  eyebrow?: string;
  actionsSlot?: ReactNode;
  filtersSlot?: ReactNode;
  tabsSlot?: ReactNode;
};

export function PortalTabScreen({
  title,
  subtitle,
  children,
  scroll = true,
  hideHeaderOnPhone = false,
  eyebrow,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: PortalTabScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const { active: messengerFocusActive } = usePortalMessengerFocus();
  const pathname = usePathname();
  const isEmployeePortal = pathname.startsWith('/portal/employee');
  const isClientPortal = pathname.startsWith('/portal/client');

  const bareBottomPadding = useMemo(() => {
    if (messengerFocusActive || !showBottomTabs) return spacing.md;
    return resolvePortalMobileContentPaddingBottom(insets.bottom);
  }, [insets.bottom, messengerFocusActive, showBottomTabs]);

  const barePaddingStyle = useMemo((): ViewStyle => {
    if (messengerFocusActive) {
      return { flex: 1, minHeight: 0, paddingBottom: 0, gap: 0 };
    }
    if (!showBottomTabs) return {};
    if (Platform.OS === 'web') {
      return {
        paddingBottom: webSafeAreaCalc(
          'bottom',
          PORTAL_MOBILE_NAV_HEIGHT + spacing.lg,
        ) as number,
      };
    }
    return { paddingBottom: bareBottomPadding };
  }, [bareBottomPadding, messengerFocusActive, showBottomTabs]);

  if (isEmployeePortal && !messengerFocusActive) {
    const page = (
      <EmployeePortalPageFrame
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        compact={hideHeaderOnPhone}
        actionsSlot={actionsSlot}
        filtersSlot={filtersSlot}
        tabsSlot={tabsSlot}
      >
        {children}
      </EmployeePortalPageFrame>
    );

    if (scroll) {
      return (
        <ScrollView
          contentContainerStyle={[styles.employeeScrollContent, barePaddingStyle]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.employeeScrollViewport}
          testID="employee-portal-tab-scroll"
        >
          {page}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.employeePage, barePaddingStyle]} testID="employee-portal-tab-screen">
        {page}
      </View>
    );
  }

  if (isClientPortal && !messengerFocusActive) {
    const page = (
      <ClientPortalPageFrame
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        compact={hideHeaderOnPhone}
        actionsSlot={actionsSlot}
        filtersSlot={filtersSlot}
        tabsSlot={tabsSlot}
      >
        {children}
      </ClientPortalPageFrame>
    );

    if (scroll) {
      return (
        <ScrollView
          contentContainerStyle={[styles.portalScrollContent, barePaddingStyle]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.portalScrollViewport}
          testID="client-portal-tab-scroll"
        >
          {page}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.portalPage, barePaddingStyle]} testID="client-portal-tab-screen">
        {page}
      </View>
    );
  }

  if (isPhone && hideHeaderOnPhone) {
    const page = (
      <View style={[styles.bareContent, scroll ? null : styles.bareContentFill, barePaddingStyle]}>
        {!messengerFocusActive && (subtitle || eyebrow) ? (
          <PortalMobileTabHeader title={title} subtitle={subtitle} eyebrow={eyebrow} />
        ) : null}
        {children}
      </View>
    );

    if (scroll && !messengerFocusActive) {
      return (
        <ScrollView
          contentContainerStyle={styles.bareScrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.bareScrollViewport}
          testID="client-portal-tab-scroll"
        >
          {page}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.bare, messengerFocusActive ? styles.bareFocus : null]} testID="portal-tab-bare">
        {page}
      </View>
    );
  }

  const shellScroll = isPhone ? false : scroll;

  return (
    <ScreenShell
      title={title}
      subtitle={isPhone ? subtitle : subtitle ?? 'Ihr persönlicher Portalbereich'}
      showBack={false}
      scroll={shellScroll}
      hideMobileLogout
      mobileContentPaddingBottom={showBottomTabs ? bareBottomPadding : undefined}
      actionsSlot={actionsSlot}
      filtersSlot={filtersSlot}
      tabsSlot={tabsSlot}
    >
      <View style={styles.content}>{children}</View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, width: '100%' },
  bare: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  bareFocus: {
    flex: 1,
    minHeight: 0,
  },
  employeePage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  portalPage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  employeeScrollViewport: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'auto',
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        } as unknown as ViewStyle)
      : null),
  },
  employeeScrollContent: {
    flexGrow: 1,
    width: '100%',
    minWidth: 0,
  },
  portalScrollViewport: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'hidden',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        } as unknown as ViewStyle)
      : null),
  },
  portalScrollContent: {
    flexGrow: 1,
    width: '100%',
    minWidth: 0,
  },
  bareContent: {
    width: '100%',
    gap: spacing.md,
  },
  bareContentFill: {
    flex: 1,
    minHeight: 0,
  },
  bareScrollViewport: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowY: 'auto',
          overflowX: 'auto',
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
        } as unknown as ViewStyle)
      : null),
  },
  bareScrollContent: {
    flexGrow: 1,
    width: '100%',
    minWidth: 0,
  },
});
