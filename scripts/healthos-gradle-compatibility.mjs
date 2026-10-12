// Verified against the Android template shipped by the locked Expo release.
// The actual generated wrapper is checked again before invoking Gradle.
export const checkedGradleVersion = '9.3.1';

export function lockedGradleVersion(lock) {
  if (lock?.packages?.['node_modules/expo']?.version !== '57.0.20' ||
      lock?.packages?.['node_modules/@react-native/gradle-plugin']?.version !== '0.86.3') {
    throw new Error('Die gesicherten Expo-/Gradle-Paketversionen wurden verändert. Gradle-/JDK-Kompatibilität erneut prüfen.');
  }
  return checkedGradleVersion;
}

export function supportsJava(major, gradleVersion) {
  if ([17, 21].includes(major)) return true;
  const match = String(gradleVersion || '').match(/^(\d+)\.(\d+)(?:\.\d+)?$/);
  return major === 25 && Boolean(match) && (Number(match[1]) > 9 || (Number(match[1]) === 9 && Number(match[2]) >= 1));
}

export function verifyGeneratedGradle(text, expectedVersion, javaMajor) {
  const lines = String(text).split(/\r?\n/).filter(line => line.trimStart().startsWith('distributionUrl='));
  const match = lines.length === 1 && lines[0].trim().match(/^distributionUrl=https(?:\\)?:\/\/services\.gradle\.org\/distributions\/gradle-(\d+\.\d+(?:\.\d+)?)-(?:bin|all)\.zip$/);
  if (!match || match[1] !== expectedVersion || !supportsJava(javaMajor, match[1])) {
    throw new Error('Die tatsächlich erzeugte Gradle-Version passt nicht zur bestätigten JDK-/Expo-Konfiguration. Der Build wurde vor der Kompilierung gestoppt.');
  }
  return { gradleVersion: match[1], javaMajor };
}
