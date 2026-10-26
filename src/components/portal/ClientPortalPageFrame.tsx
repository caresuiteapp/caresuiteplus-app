import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HealthOSPageSurface, HealthOSPageZone } from '@/components/layout/HealthOSPageSurface';
import { careSpacing } from '@/design/tokens/spacing';
import { PortalPremiumPageHero } from '@/components/portal/PortalPremiumPageHero';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { portalPremium } from '@/design/tokens/portalPremium';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
  showHero?: boolean;
  /** The surrounding ScrollView owns scrolling; content keeps its full height. */
  scrollable?: boolean;
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
  scrollable = false,
  actionsSlot,
  filtersSlot,
  tabsSlot,
}: Props) {
  const { isPhone } = useDeviceClass();

  return (
    <View style={[styles.page, scrollable ? styles.naturalContent : styles.fillContent, isPhone && styles.pagePhone]} testID="client-portal-page-frame">
      {showHero ? (
        <PortalPremiumPageHero
          kind="client"
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          compact={compact}
        />
      ) : null}
      <HealthOSPageSurface fill={!scrollable} padded={!isPhone} contentStyle={styles.workspace} testID="client-portal-page-surface">
        <HealthOSPageZone kind="actions">{actionsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="filters">{filtersSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="tabs">{tabsSlot}</HealthOSPageZone>
        <HealthOSPageZone kind="content" fill={!scrollable}>
          <View style={[styles.content, scrollable ? styles.naturalContent : styles.fillContent]}>{children}</View>
        </HealthOSPageZone>
      </HealthOSPageSurface>
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
  workspace: { backgroundColor: portalPremium.surface },
  pagePhone: {
    gap: careSpacing.sm,
    paddingHorizontal: careSpacing.sm,
  },
});
