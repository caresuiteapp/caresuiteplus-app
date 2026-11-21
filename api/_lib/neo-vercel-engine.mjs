import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executeFile = promisify(execFile);
const MODEL = { file: 'ggml-small-q5_1.bin', size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' };

/** Same bounded 16 kHz mono PCM contract as NEO's local worker. */
export function validateNeoVercelWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > 500000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw Error('invalid-audio');
  let format, data, offset = 12;
  for (; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw Error('invalid-audio');
    if (type === 'fmt ') { if (format || length < 16) throw Error('invalid-audio'); format = bytes.subarray(start, start + length); }
    if (type === 'data') { if (data) throw Error('invalid-audio'); data = bytes.subarray(start, start + length); }
    offset = start + length + length % 2;
  }
  if (offset !== bytes.length || !format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt32LE(4) !== 16000 || format.readUInt32LE(8) !== 32000 || format.readUInt16LE(12) !== 2 || format.readUInt16LE(14) !== 16 || data.length % 2 || data.length < 1600 || data.length > 384000) throw Error('invalid-audio');
  let sum = 0; for (let i = 0; i < data.length; i += 2) sum += (data.readInt16LE(i) / 32768) ** 2;
  return { seconds: data.length / 32000, rms: Math.sqrt(sum / (data.length / 2)) };
}
async function digest(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
export function createNeoVercelEngine(options = {}) {
  const directory = options.assetDirectory ?? resolve('api/_lib/neo-assets');
  // Deployment activation follows actual target-runtime and latency acceptance.
  // Copying experimental files or a successful --help must not activate ASR.
  const enabled = options.enabled ?? process.env.NEO_VERCEL_ASR_ENABLED === '1';
  const run = options.execute ?? executeFile;
  const maxActive = 1; let active = 0, verified = null;
  async function artifacts() {
    if (!enabled || process.platform !== 'linux' || process.arch !== 'x64') return null;
    try {
      const manifestPath = join(directory, 'manifest.json'), manifestStat = await lstat(manifestPath);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 8192) return null;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (manifest.version !== 'whisper.cpp-v1.8.4' || manifest.platform !== 'linux-x64' || manifest.binary?.file !== 'whisper-cli' || !/^[a-f0-9]{64}$/.test(manifest.binary?.sha256) || !Number.isInteger(manifest.binary?.size) || manifest.binary.size < 64 || manifest.binary.size > 40_000_000 || !Object.entries(MODEL).every(([key, value]) => manifest.model?.[key] === value)) return null;
      const binary = join(directory, 'whisper-cli'), model = join(directory, MODEL.file), binaryStat = await lstat(binary), modelStat = await lstat(model);
      if (![binaryStat, modelStat].every(stat => stat.isFile() && !stat.isSymbolicLink()) || binaryStat.size !== manifest.binary.size || modelStat.size !== MODEL.size || !(binaryStat.mode & 0o111)) return null;
      const key = [manifestStat.mtimeMs, manifestStat.size, binaryStat.mtimeMs, binaryStat.size, modelStat.mtimeMs, modelStat.size].join(':');
      if (verified?.key === key) return verified;
      if (await digest(binary) !== manifest.binary.sha256 || await digest(model) !== MODEL.sha256) return null;
      const header = (await readFile(binary)).subarray(0, 20);
      if (header.toString('ascii', 1, 4) !== 'ELF' || header[0] !== 0x7f || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== 62) return null;
      // A checksum alone does not prove that the Lambda runtime can load the
      // executable and its ABI. Probe without sending audio before advertising it.
      await run(binary, ['--help'], { timeout: 3000, maxBuffer: 65_536, windowsHide: true });
      verified = { key, binary, model }; return verified;
    } catch { return null; }
  }
  return {
    async status() { return { transcriptionReady: Boolean(await artifacts()) }; },
    async transcribe(encoded, signal) {
      if (typeof encoded !== 'string' || encoded.length > 666668 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('invalid-audio');
      const bytes = Buffer.from(encoded, 'base64'); if (bytes.toString('base64') !== encoded) throw Error('invalid-audio');
      const audio = validateNeoVercelWav(bytes); signal.throwIfAborted();
      if (active >= maxActive) throw Error('busy');
      const paths = await artifacts(); if (!paths) throw Error('transcription-not-configured');
      if (active >= maxActive) throw Error('busy');
      if (audio.rms < 0.003) return { text: '', engine: 'whisper.cpp-vercel' };
      active++; let temporary;
      try {
        signal.throwIfAborted(); temporary = await mkdtemp(join(tmpdir(), 'caresuite-neo-vercel-')); await chmod(temporary, 0o700);
        const input = join(temporary, 'input.wav'), output = join(temporary, 'result'); await writeFile(input, bytes, { mode: 0o600 });
        await run(paths.binary, ['-m', paths.model, '-f', input, '-l', 'de', '-oj', '-of', output, '-nt', '-np', '-t', '2', '-bs', '1'], { signal, timeout: 85_000, maxBuffer: 1024 * 1024, windowsHide: true });
        signal.throwIfAborted(); const result = JSON.parse(await readFile(output + '.json', 'utf8'));
        if (!Array.isArray(result.transcription) || result.transcription.length > 200) throw Error('invalid-transcript');
        const text = result.transcription.map(item => { if (typeof item.text !== 'string') throw Error('invalid-transcript'); return item.text; }).join(' ').replace(/\s+/g, ' ').trim();
        if (text.length > 6000) throw Error('invalid-transcript');
        return { text: /^\s*(?:\[[^\]]*\]|\([^)]*\))\s*$/.test(text) ? '' : text, engine: 'whisper.cpp-vercel' };
      } finally { active--; if (temporary) await rm(temporary, { recursive: true, force: true }); }
    },
  };
}
