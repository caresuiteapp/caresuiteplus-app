import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { PortalPremiumPageHero } from '@/components/portal/PortalPremiumPageHero';

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
      <HealthOSPageSurface padded testID="employee-portal-page-surface">
        <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="content">
          <View style={styles.content}>{children}</View>
        </HealthOSPageZone>
      </HealthOSPageSurface>
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
});
