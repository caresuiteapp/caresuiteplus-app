import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { ModuleVisibilityStatus } from '@/types/modules/visibility';
import { colors, motion, radius, typography } from '@/theme';
import { PremiumBadge } from './PremiumBadge';

type ModuleTileProps = {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  isActive?: boolean;
  preparedOnly?: boolean;
  visibilityStatus?: ModuleVisibilityStatus;
  badgeLabel?: string;
  isNavigable?: boolean;
  onPress?: () => void;
};

function resolveBadge(
  preparedOnly: boolean,
  isActive: boolean,
  visibilityStatus?: ModuleVisibilityStatus,
  badgeLabel?: string,
): { label: string; variant: 'green' | 'cyan' | 'orange' | 'muted' | 'red' } {
  if (badgeLabel) {
    if (visibilityStatus === 'coming_soon') {
      return { label: badgeLabel, variant: 'orange' };
    }
    if (visibilityStatus === 'beta') {
      return { label: badgeLabel, variant: 'cyan' };
    }
    if (visibilityStatus === 'internal') {
      return { label: badgeLabel, variant: 'muted' };
    }
  }
  if (preparedOnly) return { label: 'Vorbereitet', variant: 'orange' };
  if (visibilityStatus === 'coming_soon') {
    return { label: 'In Vorbereitung', variant: 'orange' };
  }
  return {
    label: isActive ? 'Aktiv' : 'Inaktiv',
    variant: isActive ? 'green' : 'muted',
  };
}

export function ModuleTile({
  icon,
  title,
  description,
  accentColor,
  isActive = true,
  preparedOnly = false,
  visibilityStatus,
  badgeLabel,
  isNavigable,
  onPress,
}: ModuleTileProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const navigable = isNavigable ?? isActive;
  const badge = resolveBadge(preparedOnly, isActive, visibilityStatus, badgeLabel);

  return (
    <Animated.View style={[styles.shadow, { shadowColor: accentColor }, animStyle]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress || !navigable}
        onPressIn={() => {
          if (!navigable) return;
          scale.value = withSpring(0.96, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
        style={[styles.pressable, !navigable && styles.disabled]}
      >
        <LinearGradient
          colors={['#1E2330', '#171B22']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topSheen} />
        <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <PremiumBadge label={badge.label} variant={badge.variant} dot />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.card,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  pressable: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    minHeight: 140,
    overflow: 'hidden',
    gap: 6,
  },
  disabled: {
    opacity: 0.72,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 2,
  },
  icon: {
    fontSize: 28,
    marginTop: 8,
  },
  title: {
    ...typography.bodyStrong,
  },
  description: {
    ...typography.caption,
    flex: 1,
  },
});
