import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalMobileTabHeader } from '@/components/portal/PortalMobileTabHeader';
import { ScreenShell } from '@/components/layout';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { usePortalMessengerFocus } from '@/lib/portal/portalMessengerFocusContext';
import { usePathname } from 'expo-router';
import { EmployeePortalPageFrame } from '@/components/portal/EmployeePortalPageFrame';
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
};

export function PortalTabScreen({
  title,
  subtitle,
  children,
  scroll = true,
  hideHeaderOnPhone = false,
  eyebrow,
}: PortalTabScreenProps) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const { active: messengerFocusActive } = usePortalMessengerFocus();
  const pathname = usePathname();
  const isEmployeePortal = pathname.startsWith('/portal/employee');

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
    return (
      <View style={[styles.employeePage, barePaddingStyle]} testID="employee-portal-tab-screen">
        <EmployeePortalPageFrame
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          compact={hideHeaderOnPhone}
        >
          {children}
        </EmployeePortalPageFrame>
      </View>
    );
  }

  if (isPhone && hideHeaderOnPhone) {
    return (
      <View style={[styles.bare, messengerFocusActive ? styles.bareFocus : null]} testID="portal-tab-bare">
        <View style={[styles.bareContent, barePaddingStyle]}>
          {!messengerFocusActive && (subtitle || eyebrow) ? (
            <PortalMobileTabHeader title={title} subtitle={subtitle} eyebrow={eyebrow} />
          ) : null}
          {children}
        </View>
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
  bareContent: {
    width: '100%',
    gap: spacing.md,
  },
  employeePage: {
    width: '100%',
    minHeight: 0,
  },
});
