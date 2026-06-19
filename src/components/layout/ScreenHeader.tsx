import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { spacing, typography } from '@/theme';
import { BreadcrumbTrail } from './BreadcrumbTrail';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbTrail?: BreadcrumbTrailType;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  breadcrumbTrail,
  showBack = true,
  onBack,
  rightSlot,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useLegacyTheme();
  const shellHostsAurora = useShellHostsAurora();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: shellHostsAurora ? 0 : 1,
          borderBottomColor: colors.borderSoft,
          backgroundColor: shellHostsAurora ? 'transparent' : colors.bgPremium,
        },
        left: {
          width: 88,
        },
        center: {
          flex: 1,
          alignItems: 'center',
        },
        right: {
          width: 88,
          alignItems: 'flex-end',
        },
        backButton: {
          paddingVertical: spacing.xs,
        },
        backText: {
          ...typography.caption,
          color: colors.cyan,
          fontWeight: '600',
        },
        title: {
          ...typography.h3,
          color: colors.textPrimary,
          textAlign: 'center',
        },
        subtitle: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 2,
        },
      }),
    [colors, shellHostsAurora],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <Text style={styles.backText}>← Zurück</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.center}>
        {breadcrumbTrail ? <BreadcrumbTrail trail={breadcrumbTrail} /> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
}
