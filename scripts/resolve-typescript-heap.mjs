/** Keep an explicit local compiler budget below the detected machine ceiling. */
export function resolveTypeScriptHeapMiB(totalBytes, constrainedBytes = 0, requestedMiB) {
  const memoryBytes = constrainedBytes > 0 ? Math.min(totalBytes, constrainedBytes) : totalBytes;
  const detected = Math.max(512, Math.min(8192, Math.floor(memoryBytes / 1024 / 1024) - 1024));
  if (requestedMiB === undefined) return detected;
  const parsed = Number(requestedMiB);
  if (typeof requestedMiB !== 'string' || String(parsed) !== requestedMiB || !Number.isSafeInteger(parsed) || parsed < 512) {
    throw new Error('CARESUITE_TYPESCRIPT_HEAP_MIB must be a canonical integer of at least 512.');
  }
  return Math.min(detected, parsed);
}
