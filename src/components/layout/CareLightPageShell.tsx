import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareSuiteLightBackground } from '@/components/brand/CareSuiteLightBackground';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { getBreadcrumbs } from '@/lib/navigation';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
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

/** Light premium page shell — replaces dark ScreenShell on list/detail/create routes. */
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
  const pathname = usePathname();
  const breadcrumbTrail =
    showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
        },
        scroll: {
          padding: careSpacing.md,
          gap: careSpacing.md,
          paddingBottom: careSpacing.xxl,
        },
        content: {
          flex: 1,
          padding: careSpacing.md,
          gap: careSpacing.md,
        },
        a11yRoot: {
          flex: 1,
        },
      }),
    [],
  );

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

  return (
    <CareSuiteLightBackground>
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom']}
        accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
      >
        <CareLightScreenHeader
          title={title}
          subtitle={subtitle}
          breadcrumbTrail={breadcrumbTrail}
          showBack={showBack}
          onBack={onBack}
          rightSlot={rightSlot}
        />
        <View
          style={styles.a11yRoot}
          accessible={!!a11yMeta}
          accessibilityRole={a11yMeta?.headingRole}
          accessibilityHint={a11yMeta?.reduceMotionHint}
        >
          {content}
        </View>
      </SafeAreaView>
    </CareSuiteLightBackground>
  );
}
