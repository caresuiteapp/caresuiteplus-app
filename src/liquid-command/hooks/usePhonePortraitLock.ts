import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export function usePhonePortraitLock() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const apply = async () => {
      if (shortest < 600) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
      } else {
        await ScreenOrientation.unlockAsync();
      }
    };

    void apply();
  }, [shortest]);
}

