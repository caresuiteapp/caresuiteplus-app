/** Cross-platform SHA-256 helpers for Assist execution persistence (0156). */

import { sha256Hex } from '@/lib/crypto/sha256Hex';

/** Canonical SHA-256 hex digest prefixed with `sha256:`. */
export async function computeSha256Hex(content: string): Promise<string> {
  return `sha256:${sha256Hex(content)}`;
}

/** Stable JSON stringify for payload hashing (sorted keys). */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJsonStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',')}}`;
}
