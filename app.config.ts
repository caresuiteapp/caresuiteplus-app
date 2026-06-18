import type { ExpoConfig, ConfigContext } from 'expo/config';
import { SUPPORT_LINKS } from './src/lib/platform/supportLinks';

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID;
  return {
  ...config,
  name: 'CareSuite+',
  slug: 'caresuite-plus',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'caresuiteplus',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#070B12',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'de.caresuiteplus.app',
    buildNumber: '1',
    infoPlist: {
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#070B12',
    },
    package: 'de.caresuiteplus.app',
    versionCode: 1,
    permissions: ['INTERNET'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-asset',
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'CareSuite+ benötigt Ihren Standort für Einsatz- und Fahrtenverfolgung (Funktion in Vorbereitung).',
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    ...config.extra,
    ...(easProjectId
      ? { eas: { projectId: easProjectId } }
      : {}),
    supportLinks: { ...SUPPORT_LINKS },
  },
  owner: 'kevin-caresuite',
  };
};
