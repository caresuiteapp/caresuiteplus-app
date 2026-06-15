import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { getBreadcrumbs } from '@/lib/navigation';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { spacing } from '@/theme';
import { CareLightPageShell } from './CareLightPageShell';
import { ScreenHeader } from './ScreenHeader';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  showBreadcrumbs?: boolean;
  /** WP018 — optionale Barrierefreiheits-Metadaten */
  a11yMeta?: DomainA11yMeta;
};

export function ScreenShell({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
  children,
  scroll = true,
  showBreadcrumbs = true,
  a11yMeta,
}: ScreenShellProps) {
  const { mode } = useThemeMode();

  if (mode === 'light') {
    return (
      <CareLightPageShell
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBack={onBack}
        rightSlot={rightSlot}
        scroll={scroll}
        showBreadcrumbs={showBreadcrumbs}
        a11yMeta={a11yMeta}
      >
        {children}
      </CareLightPageShell>
    );
  }

  const pathname = usePathname();
  const { colors } = useLegacyTheme();
  const breadcrumbTrail =
    showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.bgBase,
        },
        scroll: {
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
        },
        content: {
          flex: 1,
          padding: spacing.md,
          gap: spacing.md,
        },
        a11yRoot: {
          flex: 1,
        },
      }),
    [colors.bgBase],
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
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      accessibilityLabel={a11yMeta ? `${a11yMeta.screenLabel} · WP ${a11yMeta.wpNumber}` : title}
    >
      <ScreenHeader
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
  );
}
