'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { createNeoWasmRuntime } = require('./neo-wasm-runtime.cjs');
if (!parentPort) throw Error('NEO WASM requires an owned worker.');
const runtime = createNeoWasmRuntime(workerData); let busy = false, closing = false;
parentPort.on('message', async message => {
  if (!message || typeof message.id !== 'string' || !['prepare', 'transcribe', 'abort', 'dispose'].includes(message.operation)) return;
  if (message.operation === 'abort' || message.operation === 'dispose') {
    if (closing) return; closing = true;
    const result = await runtime.close(message.operation === 'abort');
    parentPort.postMessage({ kind: 'closed', id: message.id, ...result }); parentPort.close(); return;
  }
  if (closing) return;
  if (busy) { parentPort.postMessage({ kind: 'error', id: message.id, code: 'busy' }); return; }
  busy = true;
  try {
    await runtime.prepare();
    if (closing) return;
    if (message.operation === 'prepare') parentPort.postMessage({ kind: 'ready', id: message.id });
    else {
      const result = await runtime.transcribe(message.samples);
      if (!closing) parentPort.postMessage({ kind: 'result', id: message.id, ...result });
    }
  } catch (error) {
    if (!closing) {
      const allowed = ['busy', 'invalid-audio', 'invalid-transcript', 'wasm-deadline-exceeded'];
      parentPort.postMessage({ kind: 'error', id: message.id, code: allowed.includes(error?.message) ? error.message : 'wasm-unavailable' });
    }
  } finally { busy = false; }
});
