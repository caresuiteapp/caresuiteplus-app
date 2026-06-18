import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, motion, radius, typography } from '@/theme';
import { PremiumBadge } from './PremiumBadge';

type ModuleTileProps = {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  isActive?: boolean;
  preparedOnly?: boolean;
  onPress?: () => void;
};

export function ModuleTile({
  icon,
  title,
  description,
  accentColor,
  isActive = true,
  preparedOnly = false,
  onPress,
}: ModuleTileProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.shadow, { shadowColor: accentColor }, animStyle]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
        style={styles.pressable}
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
        <PremiumBadge
          label={preparedOnly ? 'Vorbereitet' : isActive ? 'Aktiv' : 'Inaktiv'}
          variant={preparedOnly ? 'orange' : isActive ? 'green' : 'muted'}
          dot
        />
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
