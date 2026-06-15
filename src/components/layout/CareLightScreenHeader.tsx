import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightBreadcrumbTrail } from './CareLightBreadcrumbTrail';

type CareLightScreenHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbTrail?: BreadcrumbTrailType;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

export function CareLightScreenHeader({
  title,
  subtitle,
  breadcrumbTrail,
  showBack = true,
  onBack,
  rightSlot,
}: CareLightScreenHeaderProps) {
  const router = useRouter();

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
        {breadcrumbTrail ? <CareLightBreadcrumbTrail trail={breadcrumbTrail} /> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: careLightColors.border,
    backgroundColor: careLightColors.surface,
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
    paddingVertical: careSpacing.xs,
  },
  backText: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    fontWeight: '600',
  },
  title: {
    ...careTypography.h3,
    color: careLightColors.navy,
    textAlign: 'center',
  },
  subtitle: {
    ...careTypography.caption,
    color: careLightColors.muted,
    textAlign: 'center',
    marginTop: 2,
  },
});
