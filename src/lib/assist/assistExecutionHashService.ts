/** Cross-platform SHA-256 helpers for Assist execution persistence (0156). */

import { createHash } from 'crypto';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fallbackDigest(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Canonical SHA-256 hex digest prefixed with `sha256:`. */
export async function computeSha256Hex(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && textEncoder) {
    const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(content));
    return `sha256:${toHex(digest)}`;
  }

  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

/** Stable JSON stringify for payload hashing (sorted keys). */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJsonStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',')}}`;
}
