const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const begin = '// CareSuite Android window migration: begin';
const end = '// CareSuite Android window migration: end';
function configureEdgeToEdgeGradle(contents) {
  // Script plugins have an isolated compile classpath in Gradle 9. Compile the
  // visitor in the app script, where the existing AGP/ASM classes are available.
  const template = readFileSync(join(__dirname, 'android-edge-to-edge', 'android-edge-to-edge.gradle'), 'utf8');
  const lines = template.split('\n');
  const imports = new Set(lines.filter(line => line.startsWith('import ')));
  const start = contents.indexOf(begin);
  if (start !== -1) {
    const stop = contents.indexOf(end, start);
    if (stop === -1) throw new Error('Android window migration: incomplete generated Gradle block.');
    contents = contents.slice(0, start) + contents.slice(stop + end.length);
  }
  contents = contents
    .replace('// CareSuite: retire legacy Android window APIs in app and dependency bytecode.', '')
    .replace('apply from: file("caresuite-edge-to-edge.gradle")', '')
    .split('\n').filter(line => !imports.has(line.trim())).join('\n');
  const body = lines.filter(line => !imports.has(line)).join('\n').trim();
  return [...imports].join('\n') + '\n\n' + contents.trim() + '\n\n' + begin + '\n' + body + '\n' + end + '\n';
}
function installAndroidEdgeToEdge(projectRoot) {
  for (const [source, destination] of [
    ['CareSuiteEdgeToEdge.java', 'android/app/src/main/java/app/caresuitehealthos/edge/CareSuiteEdgeToEdge.java'],
  ]) {
    const target = join(projectRoot, destination);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(__dirname, 'android-edge-to-edge', source), 'utf8'));
  }
}
module.exports = { configureEdgeToEdgeGradle, installAndroidEdgeToEdge };
