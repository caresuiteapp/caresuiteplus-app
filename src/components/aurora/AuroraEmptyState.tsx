import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { AuroraGradientButton } from './AuroraGradientButton';
import { auroraHeroWrapperStyle, auroraSharedStyles, AURORA_HERO_COLORS } from './auroraShared';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export function AuroraEmptyState({ title, description, actionLabel, onAction, style }: Props) {
  const { typography } = useLegacyTheme();

  return (
    <View style={[auroraHeroWrapperStyle(), styles.wrap, style]}>
      <LinearGradient colors={[...AURORA_HERO_COLORS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={auroraSharedStyles.heroGradient} />
      <View style={[auroraSharedStyles.heroContent, styles.content]}>
        <Text style={[typography.h3, styles.title]}>{title}</Text>
        {description ? <Text style={[typography.body, styles.description]}>{description}</Text> : null}
        {actionLabel && onAction ? <AuroraGradientButton label={actionLabel} onPress={onAction} /> : null}
      </View>
    </View>
  );
}

export function AuroraListCard({
  title,
  subtitle,
  meta,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
}) {
  const { typography } = useLegacyTheme();
  const cardStyle = {
    backgroundColor: careSuiteAuroraTheme.glass.backgroundStrong,
    borderColor: careSuiteAuroraTheme.glass.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: careSpacing.md,
    marginBottom: careSpacing.sm,
  } as const;

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={cardStyle}>
        <Text style={[typography.bodyStrong, { color: careSuiteAuroraTheme.text.primary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: careSuiteAuroraTheme.text.secondary, marginTop: 4 }]}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[typography.caption, { color: careSuiteAuroraTheme.text.muted, marginTop: 4 }]}>{meta}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle}>
      <Text style={[typography.bodyStrong, { color: careSuiteAuroraTheme.text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.caption, { color: careSuiteAuroraTheme.text.secondary, marginTop: 4 }]}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text style={[typography.caption, { color: careSuiteAuroraTheme.text.muted, marginTop: 4 }]}>{meta}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: careSpacing.md },
  content: { alignItems: 'center', paddingVertical: careSpacing.lg },
  title: { color: '#FFFFFF', textAlign: 'center', fontWeight: '800' },
  description: { color: careSuiteAuroraTheme.text.secondary, textAlign: 'center' },
});
