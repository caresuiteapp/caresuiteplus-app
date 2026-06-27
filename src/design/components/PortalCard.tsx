import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import {
  resolveAppStartIconSize,
  type AppStartIconKey,
} from '@/data/landing/appStartEntries';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { fxMotion } from '@/design/tokens/motion';
import { careSpacing } from '@/design/tokens/spacing';
import { noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { GlassCard } from './GlassCard';

type PortalCardProps = {
  iconKey: AppStartIconKey;
  title: string;
  description: string;
  accentColor: string;
  onPress?: () => void;
  /** Stagger index for subtle enter animation on the landing grid. */
  enterIndex?: number;
};

/** Start-page entry card — glass surface, responsive title, no mid-word breaks. */
export function PortalCard({
  iconKey,
  title,
  description,
  accentColor,
  onPress,
  enterIndex = 0,
}: PortalCardProps) {
  const type = useAuthFlowTypography();
  const { isPhone, isDesktopOrWide } = useDeviceClass();
  const iconSize = resolveAppStartIconSize(isPhone, isDesktopOrWide);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(enterIndex * 70, withTiming(1, { duration: fxMotion.base }));
    translateY.value = withDelay(enterIndex * 70, withTiming(0, { duration: fxMotion.base }));
  }, [enterIndex, opacity, translateY]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.fill, enterStyle]}>
      <GlassCard onPress={onPress} accentColor={accentColor} style={styles.cardFill}>
        <View style={styles.inner}>
          <CareSuiteIcon
            iconKey={iconKey}
            accentColor={accentColor}
            size={iconSize}
            variant="aurora"
          />
          <Text
            style={[type.cardTitle, styles.title]}
            numberOfLines={2}
            {...noBreakTextProps}
          >
            {title}
          </Text>
          {description.trim() ? (
            <Text
              style={[type.caption, styles.description]}
              numberOfLines={3}
              {...noBreakTextProps}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
  },
  cardFill: {
    flex: 1,
    minHeight: 168,
  },
  inner: {
    alignItems: 'center',
    gap: careSpacing.sm,
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  description: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
});
