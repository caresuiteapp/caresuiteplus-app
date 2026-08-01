import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  trailing?: ReactNode;
};

/** Friendly client-portal guide that replaces implementation and permission jargon. */
export function ClientPortalGuide({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  trailing,
}: Props) {
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const small = compact || isPhone;

  return (
    <View style={[styles.wrap, small && styles.wrapSmall]} testID="client-portal-guide">
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="CareSuite Portalbegleiter"
        resizeMode="contain"
        source={require('../../../assets/auth/access-client.png')}
        style={[styles.mascot, small && styles.mascotSmall]}
      />
      <View style={styles.bubble}>
        <View style={styles.bubbleTail} />
        <Text style={[type.bodyStrong, styles.title]}>{title}</Text>
        <Text style={[type.body, styles.message]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={[type.bodyStrong, styles.actionText]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 116,
    padding: 14,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    borderRadius: liquidRadius.panel,
    backgroundColor: 'rgba(8,40,76,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 18px 44px rgba(0,18,48,0.28)', backdropFilter: 'blur(20px)' } as unknown as ViewStyle)
      : { shadowColor: '#001530', shadowOpacity: 0.32, shadowRadius: 20, elevation: 7 }),
  },
  wrapSmall: { minHeight: 96, padding: 10, gap: 9 },
  mascot: { width: 98, height: 98, flexShrink: 0 },
  mascotSmall: { width: 68, height: 74 },
  bubble: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderWidth: 1,
    borderColor: liquidColors.white18,
    borderRadius: liquidRadius.card,
    backgroundColor: 'rgba(255,255,255,0.10)',
    gap: 5,
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 28,
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: liquidColors.white18,
    backgroundColor: 'rgba(24,64,105,0.96)',
    transform: [{ rotate: '45deg' }],
  },
  title: { color: liquidColors.white, fontWeight: '800' },
  message: { color: liquidColors.white88 },
  action: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 5,
    paddingHorizontal: 16,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: liquidColors.white },
  pressed: { opacity: 0.76 },
});
