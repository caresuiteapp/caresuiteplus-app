import { spawn } from 'node:child_process';
import { mkdtemp, chmod, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** No shell, no secrets in argv/environment/logs. Private-key passwords use a separate pipe. */
export async function openssl(args, { input, password, maxOutput = 24_000_000, timeout = 30_000 } = {}) {
  if (password !== undefined && (!password.length || Buffer.from(password).some(b => b === 0 || b === 10 || b === 13))) throw new Error('KEY_PASSWORD');
  return new Promise((resolve, reject) => {
    const child = spawn('openssl', args, { stdio: ['pipe', 'pipe', 'pipe', 'pipe'], shell: false });
    let size = 0, done = false; const chunks = [];
    const timer = setTimeout(() => fail('CRYPTO_TIMEOUT'), timeout);
    function fail(code) {
      if (done) return; done = true; clearTimeout(timer); child.kill('SIGKILL'); reject(new Error(code));
    }
    child.on('error', () => fail('CRYPTO_UNAVAILABLE'));
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > maxOutput) return fail('CRYPTO_OUTPUT_LIMIT');
      chunks.push(chunk);
    });
    // OpenSSL diagnostics can include subjects, paths and data; never propagate them to callers/logs.
    child.stderr.resume();
    child.stdin.on('error', () => {}); child.stdio[3].on('error', () => {});
    child.on('close', code => {
      if (done) return;
      if (code !== 0) return fail('CRYPTO_REJECTED');
      done = true; clearTimeout(timer); resolve(Buffer.concat(chunks));
    });
    child.stdin.end(input);
    child.stdio[3].end(password === undefined ? undefined : Buffer.concat([Buffer.from(password), Buffer.from('\n')]));
  });
}
export async function privateWorkspace(run) {
  const dir = await mkdtemp(join(tmpdir(), 'caresuite-gkv-')); await chmod(dir, 0o700);
  const file = async (name, bytes) => {
    if (!/^[a-z0-9.-]+$/.test(name)) throw new Error('WORKSPACE_NAME');
    const path = join(dir, name); await writeFile(path, bytes, { mode: 0o600, flag: 'wx' }); return path;
  };
  try { return await run(file); } finally { await rm(dir, { recursive: true, force: true }); }
}
