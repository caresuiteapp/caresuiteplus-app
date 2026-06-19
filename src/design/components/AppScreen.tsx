import { ReactNode, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlobalAnimatedBackground } from '@/components/ui/effects';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  contentStyle?: ViewStyle;
  keyboardAvoiding?: boolean;
  /** Skip aurora backdrop when an outer shell already provides the background. */
  bare?: boolean;
};

const DEFAULT_MAX_WIDTH = 720;

/** Premium screen shell — aurora dark backdrop, safe area, responsive padding, centered max width. */
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

  const widePad = isDesktopOrWide ? { paddingHorizontal: careSpacing.xl } : null;

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
        auroraRoot: { flex: 1, overflow: 'hidden' },
        contentLayer: { flex: 1, zIndex: 1 },
      }),
    [horizontalPadding, maxWidth],
  );

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, widePad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.static, widePad, contentStyle]}>{children}</View>
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
    <SafeAreaView style={[styles.safe, styles.contentLayer]} edges={['top', 'bottom']}>
      {wrapped}
    </SafeAreaView>
  );

  if (bare) {
    return screenBody;
  }

  return (
    <View style={styles.auroraRoot} pointerEvents="box-none">
      <StatusBar style="light" />
      <GlobalAnimatedBackground mode="dark" animated />
      {screenBody}
    </View>
  );
}
