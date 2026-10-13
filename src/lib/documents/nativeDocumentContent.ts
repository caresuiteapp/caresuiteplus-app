export type NativeDocumentNode =
  | { kind: 'text'; text: string }
  | { kind: 'element'; tag: string; attributes: Record<string, string>; children: NativeDocumentNode[] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—' };
export function decodeDocumentText(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : entity;
    }
    return ENTITIES[code] ?? entity;
  });
}

/** Read-only native document structure. No scripts, forms, frames or browser APIs. */
export function parseNativeDocumentContent(html: string): NativeDocumentNode[] {
  const content = html.replace(/<(head|script|style|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const root: Extract<NativeDocumentNode, { kind: 'element' }> = { kind: 'element', tag: 'root', attributes: {}, children: [] };
  const stack = [root];
  for (const token of content.match(/<[^>]*>|[^<]+/g) ?? []) {
    const close = /^<\/\s*([\w:-]+)/.exec(token);
    if (close) {
      const index = stack.map((node) => node.tag).lastIndexOf(close[1].toLowerCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const open = /^<\s*([\w:-]+)/.exec(token);
    if (open) {
      const tag = open[1].toLowerCase();
      if (['script', 'style', 'iframe', 'object', 'input', 'meta', 'link', 'base'].includes(tag)) continue;
      const attributes: Record<string, string> = {};
      for (const match of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g)) {
        attributes[match[1].toLowerCase()] = decodeDocumentText(match[2] ?? match[3] ?? match[4] ?? '');
      }
      const node: Extract<NativeDocumentNode, { kind: 'element' }> = { kind: 'element', tag, attributes, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!['img', 'br', 'hr', 'wbr', 'source'].includes(tag) && !/\/\s*>$/.test(token)) stack.push(node);
      continue;
    }
    if (!token.startsWith('<')) stack[stack.length - 1].children.push({ kind: 'text', text: decodeDocumentText(token).replace(/[\t\r\n ]+/g, ' ') });
  }
  return root.children;
}
