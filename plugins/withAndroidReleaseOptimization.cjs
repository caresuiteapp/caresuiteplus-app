const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

function optimizeAppBuildGradle(contents) {
  const pattern = /getDefaultProguardFile\((["'])proguard-android(?:-optimize)?\.txt\1\)/g;
  const matches = contents.match(pattern) ?? [];
  if (matches.length !== 1) throw new Error('Android release: genau eine R8-Standardkonfiguration erwartet.');
  return contents.replace(pattern, 'getDefaultProguardFile("proguard-android-optimize.txt")');
}

function withAndroidReleaseOptimization(config) {
  config = withAppBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('Android release: unerwartetes Gradle-Format.');
    config.modResults.contents = optimizeAppBuildGradle(config.modResults.contents);
    return config;
  });
  return withGradleProperties(config, config => {
    for (const key of ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds', 'android.enableR8.fullMode', 'android.r8.optimizedResourceShrinking']) {
      config.modResults = config.modResults.filter(item => !(item.type === 'property' && item.key === key));
      config.modResults.push({ type: 'property', key, value: 'true' });
    }
    return config;
  });
}
module.exports = withAndroidReleaseOptimization;
module.exports.optimizeAppBuildGradle = optimizeAppBuildGradle;
