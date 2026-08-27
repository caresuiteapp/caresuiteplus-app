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
  const isHealthOSCoreEdition = process.env.EXPO_PUBLIC_APP_EDITION === 'healthos-core';
  const isPortalOnlyEdition = process.env.EXPO_PUBLIC_APP_EDITION === 'portal-only';
  return {
  ...config,
  name: isHealthOSCoreEdition || isPortalOnlyEdition ? 'CareSuite HealthOS' : 'CareSuite+',
  slug: 'caresuite-plus',
  version: '0.2.0',
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
    buildNumber: '2',
    infoPlist: {
      NSCameraUsageDescription:
        'CareSuite benötigt Zugriff auf die Kamera, damit dienstliche Fotos und Videos direkt aufgenommen werden können.',
      NSPhotoLibraryUsageDescription:
        'CareSuite benötigt Zugriff auf Fotos und Videos, damit dienstliche Medien sicher hinzugefügt werden können.',
      NSMicrophoneUsageDescription:
        'CareSuite benötigt Mikrofonzugriff für Videos mit Ton und den VoiceCore-Sprachassistenten.',
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
    versionCode: 14,
    predictiveBackGestureEnabled: false,
    permissions: [
      'INTERNET',
      'CAMERA',
      'RECORD_AUDIO',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-router',
      {
        root: isPortalOnlyEdition ? 'app-portal' : 'app',
      },
    ],
    'expo-asset',
    'expo-font',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 24,
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
          'CareSuite benötigt Ihren Standort für aktive Einsatz- und Fahrtenbuchaufzeichnungen.',
        locationAlwaysAndWhenInUsePermission:
          'CareSuite benötigt den Standort, um eine von Ihnen gestartete dienstliche Fahrt auch im Hintergrund vollständig zu erfassen.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'CareSuite benötigt Zugriff auf Fotos und Videos, damit dienstliche Medien und Dokumentationen sicher hinzugefügt werden können.',
        cameraPermission:
          'CareSuite benötigt Zugriff auf die Kamera, damit dienstliche Fotos und Videos direkt aufgenommen werden können.',
        microphonePermission:
          'CareSuite benötigt Zugriff auf das Mikrofon, damit Videos mit Ton aufgenommen werden können.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    ...config.extra,
    router: {
      ...config.extra?.router,
      root: isPortalOnlyEdition ? 'app-portal' : 'app',
    },
    ...(easProjectId
      ? { eas: { projectId: easProjectId } }
      : {}),
    supportLinks: { ...SUPPORT_LINKS },
  },
  owner: 'kevin-caresuite',
  };
};
