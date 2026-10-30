const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const marker = '// CareSuite: retire legacy Android window APIs in app and dependency bytecode.';
function configureEdgeToEdgeGradle(contents) {
  const statement = 'apply from: file("caresuite-edge-to-edge.gradle")';
  if (contents.includes(statement)) return contents;
  return contents.trimEnd() + '\n\n' + marker + '\n' + statement + '\n';
}
function installAndroidEdgeToEdge(projectRoot) {
  for (const [source, destination] of [
    ['android-edge-to-edge.gradle', 'android/app/caresuite-edge-to-edge.gradle'],
    ['CareSuiteEdgeToEdge.java', 'android/app/src/main/java/app/caresuitehealthos/edge/CareSuiteEdgeToEdge.java'],
  ]) {
    const target = join(projectRoot, destination);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(__dirname, 'android-edge-to-edge', source), 'utf8'));
  }
}
module.exports = { configureEdgeToEdgeGradle, installAndroidEdgeToEdge };
