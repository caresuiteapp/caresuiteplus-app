import { spawnSync } from 'node:child_process';
import { isAbsolute, relative } from 'node:path';
import process from 'node:process';

const base =
  process.env.LIQUID_COMMAND_R5_BASE ??
  'f5a530cd7b82981fe417263ec02016496c6288fd';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

const changedResult = run('git', [
  'diff',
  '--name-only',
  '--diff-filter=ACMR',
  `${base}..HEAD`,
]);

if (changedResult.status !== 0) {
  process.stderr.write(changedResult.stderr || changedResult.stdout);
  console.error(`R5-Basiscommit nicht verfügbar: ${base}`);
  process.exit(1);
}

const changedFiles = new Set(
  changedResult.stdout
    .split(/\r?\n/)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter(Boolean),
);

const typecheck = run(npx, ['--no-install', 'tsc', '--noEmit', '--pretty', 'false']);
if (typecheck.error) {
  console.error(`TypeScript konnte nicht gestartet werden: ${typecheck.error.message}`);
  process.exit(1);
}

const output = `${typecheck.stdout ?? ''}${typecheck.stderr ?? ''}`;
const errorLines = output.split(/\r?\n/).filter((line) => /\berror TS\d+:/.test(line));
const changedErrors = errorLines.filter((line) => {
  const match = line.match(/^(.+?\.(?:ts|tsx))\(/);
  if (!match) return false;
  const rawPath = match[1].replaceAll('\\', '/');
  const normalized = isAbsolute(rawPath)
    ? relative(process.cwd(), rawPath).replaceAll('\\', '/')
    : rawPath;
  return changedFiles.has(normalized);
});

if (changedErrors.length) {
  console.error(
    `R5-TypeScript-Prüfung fehlgeschlagen: ${changedErrors.length} Fehler in R5-Dateien.`,
  );
  console.error(changedErrors.join('\n'));
  process.exit(1);
}

console.log(
  `R5-TypeScript-Prüfung: OK · ${changedFiles.size} geänderte Dateien · 0 neue Fehler` +
    (errorLines.length ? ` · ${errorLines.length} bekannte Altfehler außerhalb R5 dokumentiert` : ''),
);
