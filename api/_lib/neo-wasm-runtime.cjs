'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const workerThreads = require('node:worker_threads');
const WASM_SHA = '9ef5bf71b5010dc28fe52dee39bcf10029af58f3e0f1fea2b0987efdacea276a';
const MODELS = new Map([
  ['ggml-base-q5_1.bin', { size: 59707625, sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898' }],
  ['ggml-small-q5_1.bin', { size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' }],
]);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
module.exports.createNeoWasmRuntime = function createNeoWasmRuntime(configuration) {
  const children = new Set(); let module, handle = 0, closing = false, job = null;
  const settle = (error) => {
    if (!job) return;
    const current = job; job = null; clearTimeout(current.timer); for (const child of children) child.unref();
    if (error) current.reject(Error(error));
    else current.resolve({ text: current.lines.join(' ').replace(/\s+/g, ' ').trim(), engine: 'whisper.cpp-vercel' });
  };
  class OwnedWorker extends workerThreads.Worker {
    constructor(filename, options = {}) {
      super(filename, { ...options, stdout: true, stderr: true }); children.add(this);
      // The upstream runtime prints transcripts. No child output reaches logs.
      // Keep unexpected stdio private; do not start a pending read that
      // would keep an idle worker referenced. Normal output is intercepted IPC.
      this.on('exit', code => { children.delete(this); if (!closing && code !== 0) settle('wasm-worker-failed'); });
      this.on('error', () => settle('wasm-worker-failed'));
    }
  }
  const receive = (stream, input) => {
    if (!job || closing) return;
    const line = String(input);
    if (stream === 'stdout') {
      const match = /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.*)$/.exec(line);
      if (match) { job.characters += match[1].length; if (job.characters > 6000 || job.lines.length >= 200) settle('invalid-transcript'); else job.lines.push(match[1]); }
    }
    // Only the fixed stderr timing record signals completion. Spoken stdout
    // cannot forge this signal, and full_default's immediate 0 is not completion.
    if (stream === 'stderr' && /^whisper_print_timings:\s+total time\s*=\s*\d+(?:\.\d+)?\s+ms\s*$/.test(line)) settle();
  };
  return {
    async prepare() {
      if (module && handle) return;
      if (closing) throw Error('wasm-worker-closed');
      const definition = MODELS.get(path.basename(configuration.model));
      if (!definition) throw Error('invalid-model-artifact');
      const code = fs.readFileSync(configuration.source);
      if (code.length !== 1770371 || hash(code) !== WASM_SHA) throw Error('invalid-wasm-artifact');
      let modelBytes = fs.readFileSync(configuration.model);
      if (modelBytes.length !== definition.size || hash(modelBytes) !== definition.sha256) throw Error('invalid-model-artifact');
      let instance;
      const ready = new Promise((resolve, reject) => {
        const seed = { print: text => receive('stdout', text), printErr: text => receive('stderr', text), onRuntimeInitialized: () => resolve(), onAbort: () => { settle('wasm-runtime-failed'); reject(Error('wasm-runtime-failed')); } };
        const controlledRequire = name => name === 'node:worker_threads' ? { ...workerThreads, Worker: OwnedWorker } : require(name);
        // The bytes are verified unchanged before this wrapper supplies print
        // interception and worker ownership. The official child entry stays local.
        const evaluate = new Function('Module', 'require', '__filename', '__dirname', 'module', 'exports', code.toString('utf8') + '\nreturn Module;');
        const container = { exports: {} }; instance = evaluate(seed, controlledRequire, configuration.source, path.dirname(configuration.source), container, container.exports);
      });
      await ready; module = instance;
      module.FS_createDataFile('/', 'neo-model.bin', new Uint8Array(modelBytes.buffer, modelBytes.byteOffset, modelBytes.byteLength), true, false);
      modelBytes = null; handle = module.init('neo-model.bin'); module.FS_unlink('/neo-model.bin');
      if (!handle) throw Error('wasm-model-initialization-failed');
    },
    async transcribe(samples, timeoutMs = 85000) {
      if (closing || !module || !handle) throw Error('wasm-worker-unavailable');
      if (job) throw Error('busy');
      for (const child of children) child.ref();
      if (!(samples instanceof Float32Array) || samples.length < 800 || samples.length > 192000 || !samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1.001)) throw Error('invalid-audio');
      const complete = new Promise((resolve, reject) => { job = { resolve, reject, lines: [], characters: 0, timer: setTimeout(() => settle('wasm-deadline-exceeded'), timeoutMs) }; });
      try { const code = module.full_default(handle, samples, 'de', 2, false); if (code !== 0) settle('wasm-inference-failed'); }
      catch { settle('wasm-inference-failed'); }
      return complete;
    },
    async close(abort = false) {
      if (closing) return { terminatedChildren: 0 }; closing = true;
      const active = Boolean(job); settle('wasm-worker-closed');
      if (!abort && !active && module && handle) { try { module.free(handle); } catch {} }
      handle = 0; module = null;
      const owned = [...children]; await Promise.allSettled(owned.map(worker => worker.terminate())); children.clear();
      return { terminatedChildren: owned.length };
    },
  };
};
