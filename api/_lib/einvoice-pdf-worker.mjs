import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// No page rendering, JavaScript actions, XFA, links, metadata fetching or writes.
let task;
try {
  const bytes = new Uint8Array(workerData);
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('size');
  task = getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, useSystemFonts: false,
    disableFontFace: true, disableAutoFetch: true, disableStream: true, stopAtErrors: true, verbosity: 0 });
  const document = await task.promise;
  const attachments = Object.values(await document.getAttachments() || {});
  if (!attachments.length || attachments.length > 32) throw new Error('attachments');
  let total = 0;
  const candidates = [];
  for (const attachment of attachments) {
    const content = new Uint8Array(attachment.content);
    total += content.length;
    if (total > 5 * 1024 * 1024) throw new Error('expanded-size');
    const prefix = new TextDecoder().decode(content.subarray(0, 1024)).trimStart();
    const unicode = content[0] === 0xff && content[1] === 0xfe || content[0] === 0xfe && content[1] === 0xff || content[0] === 0 && content[1] === 0x3c || content[0] === 0x3c && content[1] === 0;
    if (/\.xml$/i.test(String(attachment.filename)) || prefix.startsWith('<') || unicode) candidates.push(content);
  }
  // Conservative: do not attest one XML chosen by a caller when another XML
  // attachment may contain a conflicting invoice. Other binary annexes remain allowed.
  if (candidates.length !== 1) throw new Error('ambiguous-xml');
  parentPort.postMessage({ ok: true, bytes: candidates[0] }, [candidates[0].buffer]);
} catch {
  parentPort.postMessage({ ok: false });
} finally { await task?.destroy(); }
