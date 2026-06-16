import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareSuiteLightBackground } from '@/components/brand/CareSuiteLightBackground';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { getBreadcrumbs } from '@/lib/navigation';
import type { DomainA11yMeta } from '@/lib/a11y/domainScreenMeta';
import { spacing } from '@/theme';
import { CareLightScreenHeader } from './CareLightScreenHeader';
import { ScreenHeader } from './ScreenHeader';

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

/** Light premium page shell — theme-aware; galaxy header in dark mode. */
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
  const { mode } = useThemeMode();
  const pathname = usePathname();
  const { colors } = useLegacyTheme();
  const breadcrumbTrail =
    showBreadcrumbs && pathname !== '/' ? getBreadcrumbs(pathname) : undefined;

  const lightStyles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1 },
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
        a11yRoot: { flex: 1 },
      }),
    [],
  );

  const darkStyles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bgBase },
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
        a11yRoot: { flex: 1 },
      }),
    [colors.bgBase],
  );

  const pageContent = scroll ? (
    <ScrollView
      contentContainerStyle={mode === 'light' ? lightStyles.scroll : darkStyles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={mode === 'light' ? lightStyles.content : darkStyles.content}>{children}</View>
  );

  const a11yWrap = (
    <View
      style={mode === 'light' ? lightStyles.a11yRoot : darkStyles.a11yRoot}
      accessible={!!a11yMeta}
      accessibilityRole={a11yMeta?.headingRole}
      accessibilityHint={a11yMeta?.reduceMotionHint}
    >
      {pageContent}
    </View>
  );

  if (mode !== 'light') {
    return (
      <SafeAreaView
        style={darkStyles.safe}
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
        {a11yWrap}
      </SafeAreaView>
    );
  }

  return (
    <CareSuiteLightBackground>
      <SafeAreaView
        style={lightStyles.safe}
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
        {a11yWrap}
      </SafeAreaView>
    </CareSuiteLightBackground>
  );
}
