import { describe, expect, it, afterEach } from 'vitest';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getBreadcrumbs } from '@/lib/navigation/breadcrumbs';
import type { PostgrestError } from '@supabase/supabase-js';

function pgErr(code: string, message: string): PostgrestError {
  return { code, message, details: '', hint: '' } as unknown as PostgrestError;
}

describe('toGermanSupabaseError', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it('maps RLS denial to German message', () => {
    expect(toGermanSupabaseError(pgErr('42501', 'permission denied'))).toBe(
      'Kein Zugriff auf diesen Datensatz (RLS).',
    );
  });

  it('maps missing row to not-found message', () => {
    expect(toGermanSupabaseError(pgErr('PGRST116', 'not found'))).toBe(
      'Datensatz wurde nicht gefunden.',
    );
  });

  it('shows helpful message for missing client_care_contexts in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(
      toGermanSupabaseError(pgErr('PGRST205', "Could not find the table 'public.client_care_contexts'")),
    ).toBe(
      'Datenbank-Schema unvollständig. Leistungsarten konnten nicht gespeichert werden — bitte erneut versuchen.',
    );
  });

  it('shows generic message in production for other missing tables', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(
      toGermanSupabaseError(pgErr('PGRST205', "Could not find the table 'public.client_timeline_events'")),
    ).toBe(
      'Datenbank-Schema unvollständig. Leistungsarten konnten nicht gespeichert werden — bitte erneut versuchen.',
    );
  });

  it('shows table hint in development', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(
      toGermanSupabaseError(pgErr('PGRST205', "Could not find the table 'public.client_timeline_events'")),
    ).toContain('client_timeline_events');
  });
});

describe('getBreadcrumbs client record path', () => {
  it('does not repeat Business-Bereich for /business/office/clients/[id]', () => {
    const trail = getBreadcrumbs('/business/office/clients/b0241381-4933-4a89-8879-4ae31cc4340d');
    const labels = trail.map((item) => item.label);
    const businessCount = labels.filter((l) => l === 'Business-Bereich').length;
    expect(businessCount).toBe(1);
    expect(labels).toContain('Office');
    expect(labels[labels.length - 1]).toBe('Klient:innenakte');
  });

  it('documents sub-route uses Dokumente label without duplicate Business-Bereich', () => {
    const trail = getBreadcrumbs('/business/office/clients/b0241381-4933-4a89-8879-4ae31cc4340d/documents');
    const labels = trail.map((item) => item.label);
    expect(labels.filter((l) => l === 'Business-Bereich')).toHaveLength(1);
    expect(labels[labels.length - 1]).toBe('Dokumente');
  });

  it('does not repeat Business-Bereich for /business/office/time-tracking', () => {
    const trail = getBreadcrumbs('/business/office/time-tracking');
    const labels = trail.map((item) => item.label);
    expect(labels.filter((l) => l === 'Business-Bereich')).toHaveLength(1);
    expect(labels).toContain('Office');
    expect(labels[labels.length - 1]).toBe('Arbeitszeit');
  });
});
