import type { DocumentContext, DocumentContextValue } from './types';

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/** Liest Platzhalterwert sicher aus dem Dokument-Context (kein eval, kein dynamischer Code). */
export function resolvePlaceholder(key: string, context: DocumentContext): DocumentContextValue {
  const normalized = key.trim().toLowerCase();
  const segments = normalized.split('.');
  if (segments.length < 2) return undefined;

  const [group, ...rest] = segments;
  if (FORBIDDEN_PATH_SEGMENTS.has(group) || rest.some((s) => FORBIDDEN_PATH_SEGMENTS.has(s))) {
    return undefined;
  }

  const section = context[group as keyof DocumentContext];
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return undefined;
  }

  const field = rest.join('.');
  const value = (section as Record<string, DocumentContextValue>)[field];
  return value ?? undefined;
}

export function formatPlaceholderValue(value: DocumentContextValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  return String(value);
}

export function resolvePlaceholderAsString(key: string, context: DocumentContext): string {
  return formatPlaceholderValue(resolvePlaceholder(key, context));
}
