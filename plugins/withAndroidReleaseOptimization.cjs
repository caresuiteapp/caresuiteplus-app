const { withAppBuildGradle, withProjectBuildGradle, withGradleProperties, withDangerousMod } = require('expo/config-plugins');
const { patchExpoLibrarySdk, patchReactNativeGradleCallbacks, patchExpoGeneratedDirectories } = require('./androidAgp9Compatibility.cjs');
const { configureEdgeToEdgeGradle, installAndroidEdgeToEdge } = require('./androidEdgeToEdge.cjs');

// AGP 9.0.1 supports the locked Gradle 9.3.1/JDK 17 toolchain. Keep Expo 57's
// legacy plugin DSL while migrating the actual release optimizer to AGP 9.
const androidGradlePluginVersion = '9.0.1';
const kotlinVersion = '2.2.10';

function configureProjectBuildGradle(contents) {
  for (const [module, version] of [
    ['com.android.tools.build:gradle', androidGradlePluginVersion],
    ['org.jetbrains.kotlin:kotlin-gradle-plugin', kotlinVersion],
  ]) {
    const escaped = module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`classpath\\(\\s*(["'])${escaped}(?::[^"']+)?\\1\\s*\\)`, 'g');
    if ((contents.match(pattern) ?? []).length !== 1) {
      throw new Error(`Android release: genau ein ${module}-Classpath erwartet.`);
    }
    contents = contents.replace(pattern, `classpath('${module}:${version}')`);
  }
  return contents;
}

function optimizeAppBuildGradle(contents) {
  const pattern = /getDefaultProguardFile\((["'])proguard-android(?:-optimize)?\.txt\1\)/g;
  const matches = contents.match(pattern) ?? [];
  if (matches.length !== 1) throw new Error('Android release: genau eine R8-Standardkonfiguration erwartet.');
  return contents.replace(pattern, 'getDefaultProguardFile("proguard-android-optimize.txt")');
}

function withAndroidReleaseOptimization(config) {
  config = withDangerousMod(config, ['android', config => {
    patchExpoLibrarySdk(config.modRequest.projectRoot);
    patchReactNativeGradleCallbacks(config.modRequest.projectRoot);
    patchExpoGeneratedDirectories(config.modRequest.projectRoot);
    installAndroidEdgeToEdge(config.modRequest.projectRoot);
    return config;
  }]);
  config = withProjectBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('Android release: unerwartetes Projekt-Gradle-Format.');
    config.modResults.contents = configureProjectBuildGradle(config.modResults.contents);
    return config;
  });
  config = withAppBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('Android release: unerwartetes Gradle-Format.');
    config.modResults.contents = configureEdgeToEdgeGradle(optimizeAppBuildGradle(config.modResults.contents));
    return config;
  });
  return withGradleProperties(config, config => {
    const values = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableR8.fullMode': 'true',
      'android.r8.optimizedResourceShrinking': 'true',
      // Expo/RN plugins still use the Kotlin Android plugin and BaseExtension.
      // These are Google's documented AGP 9 migration switches, not R8 opt-outs.
      'android.builtInKotlin': 'false',
      'android.newDsl': 'false',
      'android.kotlinVersion': kotlinVersion,
      // Preserve Expo/RN resource-value generation across AGP's default change.
      'android.defaults.buildfeatures.resvalues': 'true',
    };
    for (const [key, value] of Object.entries(values)) {
      config.modResults = config.modResults.filter(item => !(item.type === 'property' && item.key === key));
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
}
module.exports = withAndroidReleaseOptimization;
module.exports.optimizeAppBuildGradle = optimizeAppBuildGradle;
module.exports.configureProjectBuildGradle = configureProjectBuildGradle;
module.exports.androidGradlePluginVersion = androidGradlePluginVersion;
module.exports.kotlinVersion = kotlinVersion;
