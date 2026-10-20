import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { PortalPremiumPageHero } from '@/components/portal/PortalPremiumPageHero';
import { portalPremium } from '@/design/tokens/portalPremium';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
  showHero?: boolean;
  /** Outer ScrollView owns the viewport; Web content must keep its natural height. */
  scrollable?: boolean;
  actionsSlot?: ReactNode;
  filtersSlot?: ReactNode;
  tabsSlot?: ReactNode;
};

export function EmployeePortalPageFrame({
  title,
  subtitle,
  eyebrow = 'MEIN MITARBEITENDENPORTAL',
  children,
  compact = false,
  showHero = true,
  scrollable = false,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  const { isPhone } = useDeviceClass();
  const naturalWebHeight = Platform.OS === 'web' && scrollable;

  return (
    <View style={[styles.page, naturalWebHeight ? styles.naturalContent : styles.fillContent, isPhone && styles.pagePhone]} testID="employee-portal-page-frame">
      {showHero ? (
        <PortalPremiumPageHero
          kind="employee"
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          compact={compact}
        />
      ) : null}
      <SurfaceContrastProvider tone="light">
        <HealthOSPageSurface
          fill={!naturalWebHeight}
          padded={!isPhone}
          contentStyle={isPhone ? styles.workspacePhone : styles.workspace}
          testID="employee-portal-page-surface"
        >
          <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="content" fill={!naturalWebHeight}>
            <View style={[styles.content, naturalWebHeight ? styles.naturalContent : styles.fillContent]} testID="employee-portal-contrast-r4-workspace">
              {children}
            </View>
          </HealthOSPageZone>
        </HealthOSPageSurface>
      </SurfaceContrastProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    maxWidth: 1540,
    alignSelf: 'center',
    gap: careSpacing.lg,
  },
  content: {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    gap: careSpacing.md,
  },
  fillContent: { flex: 1 },
  naturalContent: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  pagePhone: {
    gap: careSpacing.sm,
  },
  workspacePhone: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  workspace: {
    backgroundColor: portalPremium.surface,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    borderRadius: portalPremium.radius.panel,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: portalPremium.shadow.panel } as ViewStyle)
      : {
          shadowColor: '#001B3D',
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        }),
  },
});
