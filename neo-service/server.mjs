import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createNeoRuntime } from './runtime.mjs';

export function createNeoServer(settings, runtime = createNeoRuntime(settings)) {
  if (!settings.token || settings.token.length < 32) throw Error('NEO_SERVICE_TOKEN muss mindestens 32 Zeichen lang sein.');
  const equal = value => { const a = Buffer.from(value ?? ''), b = Buffer.from(`Bearer ${settings.token}`); return a.length === b.length && timingSafeEqual(a, b); };
  const server = createServer(async (req, res) => {
    const reply = (status, value) => { if (res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    if (!equal(req.headers.authorization)) { reply(401, { ok: false, error: 'unauthorized' }); return; }
    if (req.method !== 'POST' || !['/v1/status', '/v1/transcribe', '/v1/analyze'].includes(req.url ?? '')) { reply(404, { ok: false, error: 'not-found' }); return; }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) { reply(415, { ok: false, error: 'json-required' }); return; }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 100000);
    req.on('aborted', () => controller.abort()); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 900000) { reply(413, { ok: false, error: 'request-too-large' }); return; } chunks.push(chunk); }
      let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { ok: false, error: 'invalid-json' }); return; }
      if (!input || typeof input !== 'object' || Array.isArray(input)) { reply(400, { ok: false, error: 'invalid-input' }); return; }
      const data = req.url === '/v1/status' ? await runtime.status() : req.url === '/v1/transcribe' ? await runtime.transcribe(input.audio, controller.signal) : await runtime.analyze(input.segments, controller.signal);
      reply(200, { ok: true, ...data });
    } catch (error) {
      const known = ['invalid-audio', 'invalid-audio-size', 'invalid-audio-chunk', 'invalid-audio-format', 'invalid-audio-data', 'unsupported-audio-format', 'invalid-transcript', 'reasoning-not-configured', 'transcription-not-configured', 'busy'];
      const code = known.includes(error?.message) ? error.message : controller.signal.aborted ? 'request-aborted' : 'processing-failed';
      reply(code === 'busy' ? 429 : code.endsWith('not-configured') ? 503 : 400, { ok: false, error: code });
    } finally { clearTimeout(timer); }
  });
  server.requestTimeout = 105000; server.headersTimeout = 10000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const settings = { token: process.env.NEO_SERVICE_TOKEN, binary: process.env.NEO_WHISPER_BINARY, model: process.env.NEO_WHISPER_MODEL, reasoningUrl: process.env.NEO_REASONING_URL, reasoningToken: process.env.NEO_REASONING_TOKEN };
  const port = Number(process.env.NEO_SERVICE_PORT ?? '43179');
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('Ungültiger NEO-Port.');
  const server = createNeoServer(settings);
  server.listen(port, process.env.NEO_SERVICE_HOST ?? '127.0.0.1', () => { process.stdout.write(`NEO-Sprachdienst bereit, Port ${port}. Keine Audio- oder Textprotokollierung.\n`); });
  process.on('SIGTERM', () => server.close()); process.on('SIGINT', () => server.close());
}
