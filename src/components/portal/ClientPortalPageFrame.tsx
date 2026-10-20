import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { careSpacing } from '@/design/tokens/spacing';
import { PortalPremiumPageHero } from '@/components/portal/PortalPremiumPageHero';
import { useDeviceClass } from '@/hooks/useDeviceClass';

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

export function ClientPortalPageFrame({
  title,
  subtitle,
  eyebrow = 'MEIN KLIENT:INNENPORTAL',
  children,
  compact = false,
  showHero = true,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  const { isPhone } = useDeviceClass();

  return (
    <View style={[styles.page, isPhone && styles.pagePhone]} testID="client-portal-page-frame">
      {showHero ? (
        <PortalPremiumPageHero
          kind="client"
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          compact={compact}
        />
      ) : null}
      <HealthOSPageSurface padded={!isPhone} testID="client-portal-page-surface">
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
  pagePhone: {
    gap: careSpacing.sm,
  },
});
