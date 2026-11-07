import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { EmployeePortalPageHeader } from './employee/EmployeePortalPageHeader';
import { employeePortalLayout, employeePortalWorkspace as c } from './employee/employeePortalDesign';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
  showHero?: boolean;
  /** Outer ScrollView owns the viewport; its content keeps its natural height. */
  scrollable?: boolean;
  actionsSlot?: ReactNode;
  filtersSlot?: ReactNode;
  tabsSlot?: ReactNode;
};

export function EmployeePortalPageFrame({
  title,
  subtitle,
  eyebrow,
  children,
  compact = false,
  showHero = true,
  scrollable = false,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  const { width, isPhone } = useDeviceClass();
  const { padding } = employeePortalLayout(width);
  const sizing = scrollable ? styles.naturalContent : styles.fillContent;

  return (
    <SurfaceContrastProvider tone="light">
      <View style={[styles.page, sizing, { paddingHorizontal: padding }, isPhone && styles.pagePhone]} testID="employee-portal-page-frame">
        {showHero ? (
          <EmployeePortalPageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} compact={compact || isPhone}
            actions={actionsSlot} testID="employee-portal-premium-page-hero" />
        ) : null}
        <View style={[styles.content, sizing]} testID="employee-portal-page-surface">
          {!showHero ? <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone> : null}
          <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
          <HealthOSPageZone kind="content" fill={!scrollable}>
            <View style={[styles.content, sizing]} testID="employee-portal-contrast-r4-workspace">
              {children}
            </View>
          </HealthOSPageZone>
        </View>
      </View>
    </SurfaceContrastProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    maxWidth: 1440,
    alignSelf: 'center',
    paddingVertical: 18,
    gap: 14,
    backgroundColor: c.canvas,
  },
  content: {
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    gap: 12,
  },
  fillContent: { flex: 1 },
  naturalContent: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  pagePhone: { paddingVertical: 10, gap: 8 },
});
