import { useEffect, type PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { CARESUITE_NATIVE_FONT_FAMILY } from './tokens/fontFamily';

const fontAssets = {
  [CARESUITE_NATIVE_FONT_FAMILY]: require('../../public/fonts/CenturyGothic.ttf'),
};

/** The font travels in the app bundle and needs no network connection. */
export function CareSuiteFontProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(fontAssets);
  useEffect(() => {
    if (error) console.warn('CareSuite font could not be loaded', error);
  }, [error]);
  // A font error must not leave the operational app blocked indefinitely.
  if (!loaded && !error) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071225' }}>
      <ActivityIndicator size="large" color="#69E8FF" />
    </View>;
  }
  return <>{children}</>;
}
