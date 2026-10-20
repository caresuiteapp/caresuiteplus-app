import { safeWebReturnPath } from './webLoginReturn';

/** The entry URL belongs to the document, not to a remount of its route tree. */
export function createWebDocumentStartup(entryPath: string | null) {
  let settled = false;
  return {
    entryPath,
    get settled() { return settled; },
    settle(): boolean {
      if (settled) return false;
      settled = true;
      return true;
    },
    cancel(): void { settled = true; },
  };
}

const startup = createWebDocumentStartup(typeof window === 'undefined' ? null :
  safeWebReturnPath(window.location.pathname + window.location.search + window.location.hash));

export function getWebDocumentStartup() { return startup; }
export function cancelWebDocumentStartup(): void { startup.cancel(); }
