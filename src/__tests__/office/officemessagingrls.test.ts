import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/0092_office_messaging_phase3.sql',
);

describe('Migration 0092 Portal RLS', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('definiert current_client_id und current_employee_id Helper', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_client_id()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_employee_id()');
    expect(sql).toContain('resolve_current_employee_id()');
  });

  it('Portal-SELECT filtert auf eigene client_id / employee_id', () => {
    expect(sql).toContain('client_id = public.current_client_id()');
    expect(sql).toContain('employee_id = public.resolve_current_employee_id()');
  });

  it('Portal-INSERT erzwingt eigenen Absender', () => {
    expect(sql).toContain('sender_client_id = public.current_client_id()');
    expect(sql).toContain('sender_employee_id = public.resolve_current_employee_id()');
  });

  it('fügt portal_unread_count und Schnellantwort-Templates hinzu', () => {
    expect(sql).toContain('portal_unread_count');
    expect(sql).toContain('message_quick_reply_templates');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE public.messages');
  });
});
