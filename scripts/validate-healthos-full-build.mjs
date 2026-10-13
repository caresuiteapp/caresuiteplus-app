#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [resultFile, remoteFile, commit, stateDirectory] = process.argv.slice(2);
if (!resultFile || !remoteFile || !commit || !stateDirectory) {
  throw new Error('Aufruf: node scripts/validate-healthos-full-build.mjs Build-JSON Remote-Version-JSON Commit Statusordner');
}
const parseCode = (value, label) => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${label} ist kein gültiger Android-Versionscode.`);
  }
  return Number(value);
};
const baseline = parseCode(JSON.parse(readFileSync(remoteFile, 'utf8')).versionCode, 'EAS-Basis');
if (baseline < 40) throw new Error('Die EAS-Basis ist älter als der bereits verwendete Release 40.');
if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Ungültiger geprüfter Release-Commit.');
const result = JSON.parse(readFileSync(resultFile, 'utf8'));
const rows = Array.isArray(result) ? result : [result];
if (rows.length !== 1) throw new Error('Keine eindeutige Build-Antwort.');
const build = rows[0];
if (!build || String(build.platform).toLowerCase() !== 'android' || String(build.status).toLowerCase() !== 'finished') {
  throw new Error('Der Android-Build wurde nicht erfolgreich abgeschlossen.');
}
const code = parseCode(build.appBuildVersion, 'Build-Version');
if (build.appVersion !== '0.4.0' || code <= 40 || code <= baseline) throw new Error('Der AAB hat nicht die erwartete höhere Release-Version.');
if (build.buildProfile !== 'healthos-full-aab' || build.gitCommitHash !== commit) throw new Error('Der Build gehört nicht zum geprüften vollständigen Release-Stand.');
if (build.project?.id !== '567bda34-8356-4de8-9349-a0de3143567e') throw new Error('Falsches Build-Projekt.');
if (typeof build.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(build.id)) throw new Error('Ungültige Build-ID.');
if (typeof build.artifacts?.buildUrl !== 'string') throw new Error('Die AAB-Downloadadresse fehlt.');
const url = new URL(build.artifacts.buildUrl);
if (url.protocol !== 'https:' || url.username || url.password || !url.pathname.toLowerCase().endsWith('.aab')) {
  throw new Error('Keine gültige HTTPS-AAB-Adresse.');
}
// Write download inputs only after the complete response passed verification.
writeFileSync(join(stateDirectory, 'build-id.txt'), build.id);
writeFileSync(join(stateDirectory, 'build-code.txt'), String(code));
writeFileSync(join(stateDirectory, 'download-url.txt'), url.href);
console.log(`Vollständiger AAB geprüft: 0.4.0 (${code}), Build-ID ${build.id}.`);
