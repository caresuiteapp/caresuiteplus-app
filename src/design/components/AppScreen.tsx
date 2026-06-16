import { ReactNode, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { SpaceBackground } from './SpaceBackground';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  contentStyle?: ViewStyle;
  keyboardAvoiding?: boolean;
  /** Skip SpaceBackground when an outer shell already provides the backdrop. */
  bare?: boolean;
};

const DEFAULT_MAX_WIDTH = 720;

/** Premium screen shell — space gradient, safe area, responsive padding, centered max width. */
export function AppScreen({
  children,
  scroll = true,
  maxWidth = DEFAULT_MAX_WIDTH,
  contentStyle,
  keyboardAvoiding = false,
  bare = false,
}: AppScreenProps) {
  const { isPhone, isTablet, isDesktopOrWide } = useDeviceClass();

  const horizontalPadding = isPhone
    ? careSpacing.md
    : isTablet
      ? careSpacing.lg
      : careSpacing.xl;

  const widePadStyle = isDesktopOrWide ? { paddingHorizontal: careSpacing.xl } : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1 },
        inner: {
          flex: 1,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
        },
        scroll: {
          flexGrow: 1,
          paddingHorizontal: horizontalPadding,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.xxl,
          gap: careSpacing.md,
        },
        static: {
          flex: 1,
          paddingHorizontal: horizontalPadding,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.xxl,
          gap: careSpacing.md,
        },
      }),
    [horizontalPadding, maxWidth],
  );

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, widePadStyle, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.static, widePadStyle, contentStyle]}>{children}</View>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.inner}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.inner}>{body}</View>
  );

  const screenBody = (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {wrapped}
    </SafeAreaView>
  );

  if (bare) {
    return screenBody;
  }

  return <SpaceBackground>{screenBody}</SpaceBackground>;
}
