const ENTRY_PATH = /^\/_expo\/static\/js\/web\/entry-[a-f0-9]{16,64}\.js$/i;

/** Identify the initial Expo bundle, never a lazily loaded route or external script. */
export function webEntryScript(sources: Iterable<string>, origin: string): string | null {
  const entries = new Set<string>();
  for (const source of sources) {
    try {
      const url = new URL(source, origin);
      if (url.origin === origin && ENTRY_PATH.test(url.pathname) && !url.search && !url.hash) {
        entries.add(url.href);
      }
    } catch { /* An invalid script URL cannot identify a release. */ }
  }
  return entries.size === 1 ? [...entries][0] : null;
}

export function webEntryScriptFromHtml(html: string, origin: string): string | null {
  const sources: string[] = [];
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const script of withoutComments.matchAll(/<script\b([^>]*)>/gi)) {
    const source = script[1].match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (source) sources.push(source[1] ?? source[2]);
  }
  return webEntryScript(sources, origin);
}

/** Public HTML only: no session, tenant data or credentials are transmitted. */
export async function latestWebEntryScript(
  origin: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetcher(new URL('/index.html', origin).href, {
      cache: 'no-store', credentials: 'omit', signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
    const html = await response.text();
    if (signal.aborted || html.length > 1_000_000) return null;
    return webEntryScriptFromHtml(html, origin);
  } catch {
    // Offline, login/protection pages and failed deploys must not interrupt work.
    return null;
  }
}
