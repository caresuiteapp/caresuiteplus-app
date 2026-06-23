import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ScreensaverSettings } from '@/lib/screensaver/screensaverTypes';
import { ScreensaverClock } from './modes/ScreensaverClock';
import { ScreensaverClockDate } from './modes/ScreensaverClockDate';
import { ScreensaverLogoBounce } from './modes/ScreensaverLogoBounce';
import { ScreensaverLogoStatic } from './modes/ScreensaverLogoStatic';

type ScreensaverOverlayProps = {
  visible: boolean;
  settings: ScreensaverSettings;
  onDismiss: () => void;
};

const webBlurStyle =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      } as ViewStyle)
    : null;

export function ScreensaverOverlay({ visible, settings, onDismiss }: ScreensaverOverlayProps) {
  if (!visible) return null;

  const handleCapture = () => {
    onDismiss();
  };

  const modeContent = (() => {
    switch (settings.mode) {
      case 'logo_static':
        return <ScreensaverLogoStatic logoSize={settings.logoSize} />;
      case 'logo_bounce':
        return (
          <ScreensaverLogoBounce
            logoSize={settings.logoSize}
            bounceSpeed={settings.bounceSpeed}
            active
          />
        );
      case 'clock':
        return (
          <ScreensaverClock use24h={settings.use24h} showSeconds={settings.showSeconds} />
        );
      case 'clock_date':
        return (
          <ScreensaverClockDate
            use24h={settings.use24h}
            showSeconds={settings.showSeconds}
            showDate={settings.showDate}
            showWeekday={settings.showWeekday}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <Pressable
      style={[styles.overlay, webBlurStyle]}
      onPress={handleCapture}
      accessibilityRole="button"
      accessibilityLabel="Bildschirmschoner beenden"
      testID="global-screensaver-overlay"
    >
      <View style={styles.content} pointerEvents="box-none">
        {settings.mode === 'logo_bounce' ? modeContent : (
          <View style={styles.centered}>{modeContent}</View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2500,
    backgroundColor: 'rgba(248,250,252,0.14)',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as const)
      : null),
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
