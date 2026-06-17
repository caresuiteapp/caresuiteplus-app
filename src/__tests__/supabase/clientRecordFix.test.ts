import { describe, expect, it, afterEach } from 'vitest';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getBreadcrumbs } from '@/lib/navigation/breadcrumbs';

describe('toGermanSupabaseError', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('maps RLS denial to German message', () => {
    expect(toGermanSupabaseError({ code: '42501', message: 'permission denied', details: '', hint: '' })).toBe(
      'Kein Zugriff auf diesen Datensatz (RLS).',
    );
  });

  it('maps missing row to not-found message', () => {
    expect(toGermanSupabaseError({ code: 'PGRST116', message: 'not found', details: '', hint: '' })).toBe(
      'Datensatz wurde nicht gefunden.',
    );
  });

  it('shows helpful message for missing client_care_contexts in production', () => {
    process.env.NODE_ENV = 'production';
    expect(
      toGermanSupabaseError({
        code: 'PGRST205',
        message: "Could not find the table 'public.client_care_contexts'",
        details: '',
        hint: '',
      }),
    ).toBe(
      'Datenbank-Schema unvollständig. Leistungsarten konnten nicht gespeichert werden — bitte erneut versuchen.',
    );
  });

  it('shows generic message in production for other missing tables', () => {
    process.env.NODE_ENV = 'production';
    expect(
      toGermanSupabaseError({
        code: 'PGRST205',
        message: "Could not find the table 'public.client_timeline_events'",
        details: '',
        hint: '',
      }),
    ).toBe(
      'Datenbank-Schema unvollständig. Leistungsarten konnten nicht gespeichert werden — bitte erneut versuchen.',
    );
  });

  it('shows table hint in development', () => {
    process.env.NODE_ENV = 'development';
    expect(
      toGermanSupabaseError({
        code: 'PGRST205',
        message: "Could not find the table 'public.client_timeline_events'",
        details: '',
        hint: '',
      }),
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
});
