import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { motion, spacing, typography } from '@/theme';
import { PremiumDivider } from './PremiumDivider';

type Props = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  showDivider?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PremiumListRow({
  title,
  subtitle,
  leading,
  trailing,
  showChevron = false,
  showDivider = false,
  onPress,
  style,
}: Props) {
  const text = useAuroraAdaptiveText();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: '100%',
        },
        pressable: {
          borderRadius: 8,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          minHeight: 56,
        },
        leading: {
          flexShrink: 0,
        },
        textBlock: {
          flex: 1,
          gap: 2,
        },
        title: {
          ...typography.bodyStrong,
          color: text.primary,
        },
        subtitle: {
          ...typography.caption,
          color: text.secondary,
        },
        trailing: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flexShrink: 0,
        },
        chevron: {
          fontSize: 22,
          color: text.muted,
          fontWeight: '300',
          marginLeft: 2,
        },
        divider: {
          marginLeft: spacing.sm,
        },
      }),
    [text.muted, text.primary, text.secondary],
  );

  const content = (
    <>
      <View style={styles.row}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.trailing}>
          {trailing}
          {showChevron ? <Text style={styles.chevron}>›</Text> : null}
        </View>
      </View>
      {showDivider ? <PremiumDivider style={styles.divider} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.container, style]}>{content}</View>;
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={[styles.container, styles.pressable, style]}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.985, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}
