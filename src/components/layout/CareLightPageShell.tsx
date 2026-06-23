import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareSuiteLightBackground } from '@/components/brand/CareSuiteLightBackground';
import { careSpacing } from '@/design/tokens/spacing';
import { getBreadcrumbs } from '@/lib/navigation';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { ScreenHeader } from './ScreenHeader';
import { CareLightScreenHeader } from './CareLightScreenHeader';

type CareLightPageShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  a11yMeta?: DomainA11yMeta;
};

/** Light premium page shell — transparent passthrough when PlatformShell hosts Aurora. */
export function CareLightPageShell({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  children,
  scroll = true,
  showBreadcrumbs = true,
  a11yMeta,
}: CareLightPageShellProps) {
  const shellHostsAurora = useShellHostsAurora();
  const pathname = usePathname();
  const breadcrumbTrail =
    showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        auroraRoot: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 0,
          backgroundColor: 'transparent',
        },
        safe: {
          flex: 1,
          backgroundColor: shellHostsAurora ? 'transparent' : undefined,
        },
        scrollHost: {
          flex: 1,
          flexGrow: 1,
          width: '100%',
        },
        scroll: {
          flexGrow: 1,
          padding: careSpacing.md,
          gap: careSpacing.md,
          paddingBottom: careSpacing.xxl,
        },
        contentHost: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
          padding: careSpacing.md,
          gap: careSpacing.md,
        },
        content: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          padding: careSpacing.md,
          gap: careSpacing.md,
        },
        a11yRoot: {
          flex: 1,
          flexGrow: 1,
          minHeight: 0,
          width: '100%',
        },
      }),
    [shellHostsAurora],
  );

  const header = shellHostsAurora ? (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      breadcrumbTrail={breadcrumbTrail}
      showBack={showBack}
      onBack={onBack}
      rightSlot={rightSlot}
    />
  ) : (
    <CareLightScreenHeader
      title={title}
      subtitle={subtitle}
      breadcrumbTrail={breadcrumbTrail}
      showBack={showBack}
      onBack={onBack}
      rightSlot={rightSlot}
    />
  );

  const a11yProps = {
    accessible: !!a11yMeta,
    accessibilityRole: a11yMeta?.headingRole,
    accessibilityHint: a11yMeta?.reduceMotionHint,
  } as const;

  if (shellHostsAurora) {
    const body = scroll ? (
      <ScrollView
        style={styles.scrollHost}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={styles.contentHost}>{children}</View>
    );

    return (
      <View
        style={styles.auroraRoot}
        testID="care-light-page-shell"
        accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
      >
        {header}
        <View style={styles.a11yRoot} {...a11yProps}>
          {body}
        </View>
      </View>
    );
  }

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  const inner = (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
    >
      {header}
      <View style={styles.a11yRoot} {...a11yProps}>
        {content}
      </View>
    </SafeAreaView>
  );

  return <CareSuiteLightBackground>{inner}</CareSuiteLightBackground>;
}
