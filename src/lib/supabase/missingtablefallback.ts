import type { ServiceResult } from '@/types';
import { isMissingTableServiceError, isSupabaseMissingTableError } from './errors';

export const DEMO_DATA_BANNER = 'DEMO_DATA_BANNER';
export const PREVIEW_DATA_BANNER_MESSAGE =
  'Vorschaudaten — einige Tabellen sind in dieser Umgebung noch nicht verfügbar.';

export type PreviewAwareResult<T> =
  | { ok: true; data: T; previewData?: boolean; usedDemoFallback?: boolean; tableMissing?: boolean }
  | { ok: false; error: string };

type MissingTableListResult<T> =
  | { ok: true; data: T; usedDemoFallback: boolean }
  | { ok: false; error: string };

function canUseDemoFallback(tenantId: string): boolean {
  return tenantId === 'demo-tenant' || tenantId.startsWith('demo-');
}

export function isMissingTableError(error: unknown): boolean {
  if (typeof error === 'string') {
    return (
      error.includes('PGRST205') ||
      error.includes('Could not find the table') ||
      error.includes('schema cache')
    );
  }
  if (error && typeof error === 'object') {
    const record = error as { code?: string; message?: string };
    if (record.code === 'PGRST205') return true;
    if (typeof record.message === 'string') {
      return (
        record.message.includes('Could not find the table') ||
        record.message.includes('schema cache')
      );
    }
  }
  return isSupabaseMissingTableError(error) || isMissingTableServiceError(error);
}

export function isTableMissingResult<T>(result: ServiceResult<T> | { tableMissing?: boolean }): boolean {
  if ('tableMissing' in result && result.tableMissing) return true;
  if (!('ok' in result) || result.ok) return false;
  return isMissingTableError(result.error);
}

export function handleMissingTableQuery<T>(
  result: ServiceResult<T>,
  fallback: T,
  tenantId: string,
): PreviewAwareResult<T> {
  if (result.ok) {
    if (result.tableMissing && canUseDemoFallback(tenantId)) {
      return { ok: true, data: fallback, previewData: true };
    }
    return { ok: true, data: result.data, previewData: false };
  }

  if (isMissingTableError(result.error) && canUseDemoFallback(tenantId)) {
    return { ok: true, data: fallback, previewData: true };
  }

  return result;
}

export function resolveMissingTableList<T>(
  result: ServiceResult<T[]>,
  tenantId: string,
  fallback: () => T[],
): MissingTableListResult<T[]> {
  if (result.ok && result.tableMissing && canUseDemoFallback(tenantId)) {
    return { ok: true, data: fallback(), usedDemoFallback: true };
  }

  if (!result.ok && isMissingTableError(result.error) && canUseDemoFallback(tenantId)) {
    return { ok: true, data: fallback(), usedDemoFallback: true };
  }

  if (!result.ok) return result;

  return { ok: true, data: result.data, usedDemoFallback: false };
}
