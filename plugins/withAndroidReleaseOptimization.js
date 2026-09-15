const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Expo SDK 57 uses AGP 8.12, where optimized resource shrinking is opt-in.
module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, (mod) => {
    for (const [key, value] of Object.entries({
      'android.r8.optimizedResourceShrinking': 'true',
      'android.enableR8.fullMode': 'true',
    })) {
      mod.modResults = mod.modResults.filter(
        (entry) => entry.type !== 'property' || entry.key !== key,
      );
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('Review Android release optimization for the new Gradle template.');
    }
    const optimized = 'proguard-android-optimize.txt';
    mod.modResults.contents = mod.modResults.contents.replace(
      /getDefaultProguardFile\((['"])proguard-android\.txt\1\)/g,
      `getDefaultProguardFile("${optimized}")`,
    );
    if (!mod.modResults.contents.includes(`getDefaultProguardFile("${optimized}")`) &&
        !mod.modResults.contents.includes(`getDefaultProguardFile('${optimized}')`)) {
      throw new Error('Android release must use the optimizing ProGuard defaults.');
    }
    return mod;
  });
};
