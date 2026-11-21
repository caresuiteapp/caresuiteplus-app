import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const directory = resolve('.neo-runtime');
try {
  const settings = JSON.parse(await readFile(resolve(directory, 'settings.json'), 'utf8'));
  if (typeof settings.token !== 'string' || settings.token.length < 32) throw Error('config');
  const serviceUrl = process.env.NEO_SERVICE_URL;
  if (serviceUrl) {
    const url = new URL(serviceUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('https');
    // Private file for the existing Supabase CLI; the token is never printed or committed.
    const secrets = resolve(directory, 'supabase-secrets.env');
    await writeFile(secrets, `NEO_SERVICE_URL=${url.href}\nNEO_SERVICE_TOKEN=${settings.token}\n`, { mode: 0o600 }); await chmod(secrets, 0o600);
  }
  const child = spawn(process.execPath, [resolve(directory, 'server.mjs')], { stdio: 'inherit', env: { ...process.env,
    NEO_SERVICE_TOKEN: settings.token, NEO_WHISPER_MODEL: process.env.NEO_WHISPER_MODEL || settings.model,
    NEO_WHISPER_BINARY: process.env.NEO_WHISPER_BINARY || settings.binary,
  } });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  child.on('error', () => { console.error('NEO-Sprachdienst konnte nicht starten.'); process.exitCode = 1; });
  process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
} catch { console.error('Private NEO-Konfiguration oder gebauter Dienst fehlt. Zuerst scripts/prepare-neo-local.mjs und scripts/build-neo-service.mjs ausführen.'); process.exitCode = 1; }
