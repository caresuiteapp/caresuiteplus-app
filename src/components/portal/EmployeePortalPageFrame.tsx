import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { PortalPremiumPageHero } from '@/components/portal/PortalPremiumPageHero';
import { portalPremium } from '@/design/tokens/portalPremium';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
  showHero?: boolean;
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
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  return (
    <View style={styles.page} testID="employee-portal-page-frame">
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
          padded
          contentStyle={styles.workspace}
          testID="employee-portal-page-surface"
        >
          <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="content">
            <View style={styles.content} testID="employee-portal-contrast-r4-workspace">
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
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    maxWidth: 1540,
    alignSelf: 'center',
    gap: careSpacing.lg,
  },
  content: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    gap: careSpacing.md,
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
