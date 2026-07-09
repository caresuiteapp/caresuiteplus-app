import type { ExpoConfig, ConfigContext } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORT_LINKS } from './src/lib/platform/supportLinks';

const ANDROID_PROGUARD_RULES = readFileSync(
  join(__dirname, 'android-proguard-rules.pro'),
  'utf8',
);

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID;
  return {
  ...config,
  name: 'CareSuite+',
  slug: 'caresuite-plus',
  version: '0.1.1',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'caresuiteplus',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F8FAFC',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'de.caresuiteplus.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'CareSuite+ benötigt Mikrofonzugriff für den VoiceCore-Sprachassistenten.',
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
      backgroundColor: '#F8FAFC',
    },
    package: 'app.caresuiteplus',
    versionCode: 9,
    permissions: ['INTERNET', 'RECORD_AUDIO'],
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
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: ANDROID_PROGUARD_RULES,
        },
      },
    ],
    [
      'expo-av',
      {
        microphonePermission:
          'CareSuite+ benötigt Mikrofonzugriff für den VoiceCore-Sprachassistenten.',
      },
    ],
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
