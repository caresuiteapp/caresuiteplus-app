import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_TENANT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTENT = {
  text: 'Notiz', cues: '', summary: '',
  fields: [{ id: 'field', label: 'Feld', value: '' }],
  tasks: [{ id: 'task', text: '', status: 'open', assignee: '', dueDate: '2026-10-17' }],
  sources: [{ id: 'source', title: '', url: 'https://example.org' }],
  nodes: [
    { id: 'root', parentId: null as string | null, text: 'Mitte', x: 500, y: 300 },
    { id: 'child', parentId: 'root', text: 'Kind', x: 1000, y: 600 },
  ],
  strokes: [{ id: 'stroke', color: '#F00', width: 20, points: [[0, 0], [1000, 600]] }],
};

function schemaSql() {
  if (process.env.OFFICE_PRIVATE_NOTES_SQL_PATH) {
    return readFileSync(resolve(process.env.OFFICE_PRIVATE_NOTES_SQL_PATH), 'utf8');
  }
  const directory = resolve('supabase/migrations');
  const candidates = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => ({ file, sql: readFileSync(resolve(directory, file), 'utf8') }))
    .filter(({ sql }) => /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.office_private_notes\b/i.test(sql));
  if (candidates.length !== 1) {
    throw new Error('Expected one office_private_notes schema migration in supabase/migrations. For an unapplied local draft, set OFFICE_PRIVATE_NOTES_SQL_PATH to its SQL file.');
  }
  return candidates[0].sql;
}

// Synthetic authentication functions exercise the real note policies and trigger
// without contacting Supabase or using production profiles, users or note data.
const FIXTURE = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.uid', true), '')::uuid
$$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.tenant', true), '')::uuid
$$;
CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('test.role', true), '')
$$;
CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.permission', true) = 'true'
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
INSERT INTO auth.users VALUES ('${USER}'), ('${OTHER_USER}');
INSERT INTO public.tenants VALUES ('${TENANT}'), ('${OTHER_TENANT}');
`;

type Row = { id: string; revision: number; created_at: Date; updated_at: Date; archived_at: Date | null };
let db: PGlite;

async function actor(user = USER, tenant = TENANT, role = 'owner', permission = true) {
  await db.query("SELECT set_config('test.uid', $1, false), set_config('test.tenant', $2, false), set_config('test.role', $3, false), set_config('test.permission', $4, false)", [user, tenant, role, String(permission)]);
}

async function insert(content: unknown = CONTENT, tags: string[] = [], date: string | null = null) {
  return db.query<Row>('INSERT INTO public.office_private_notes(tenant_id, owner_user_id, title, content, tags, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [TENANT, USER, 'Meine Notiz', JSON.stringify(content), tags, date]);
}

async function note() {
  return (await insert()).rows[0];
}

beforeAll(async () => {
  const { PGlite: Database } = await import('@electric-sql/pglite');
  db = new Database();
  await db.exec(FIXTURE);
  await db.exec(schemaSql());
}, 30_000);

beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE public.office_private_notes; SET ROLE authenticated;');
  await actor();
});

afterAll(async () => { await db?.close(); });

describe('private Office notes SQL isolation and concurrency', () => {
  it('stores the complete editor payload at revision 1 with server timestamps', async () => {
    const saved = await note();
    expect(saved).toMatchObject({ tenant_id: TENANT, owner_user_id: USER, revision: 1, content: CONTENT });
    expect(saved.created_at).toEqual(saved.updated_at);
    expect(saved.archived_at).toBeNull();
  });

  it.each(['owner', 'admin'])('does not let another %s read or change the owner’s note', async (role) => {
    const { id } = await note();
    await actor(OTHER_USER, TENANT, role);
    expect((await db.query('SELECT id FROM public.office_private_notes')).rows).toEqual([]);
    expect((await db.query('UPDATE public.office_private_notes SET title = $1, revision = 2 WHERE id = $2 RETURNING id', ['Changed', id])).rows).toEqual([]);
    expect((await db.query('DELETE FROM public.office_private_notes WHERE id = $1 RETURNING id', [id])).rows).toEqual([]);
    await expect(insert()).rejects.toMatchObject({ code: '42501' });
  });

  it('isolates the same authenticated user across tenants', async () => {
    await note();
    await actor(USER, OTHER_TENANT);
    expect((await db.query('SELECT id FROM public.office_private_notes')).rows).toEqual([]);
    await expect(insert()).rejects.toMatchObject({ code: '42501' });
  });

  it.each(['employee_portal', 'client_portal', 'family_portal', ''])('denies effective role %j even with office.access', async (role) => {
    await note();
    await actor(USER, TENANT, role);
    expect((await db.query('SELECT id FROM public.office_private_notes')).rows).toEqual([]);
    await expect(insert()).rejects.toMatchObject({ code: '42501' });
  });

  it('denies read and write access after office.access is removed', async () => {
    await note();
    await actor(USER, TENANT, 'owner', false);
    expect((await db.query('SELECT id FROM public.office_private_notes')).rows).toEqual([]);
    await expect(insert()).rejects.toMatchObject({ code: '42501' });
  });

  it('does not expose the table to anonymous clients', async () => {
    await db.exec('RESET ROLE; SET ROLE anon;');
    await expect(db.query('SELECT id FROM public.office_private_notes')).rejects.toMatchObject({ code: '42501' });
  });

  it('requires revision increments and makes stale conditional updates return no row', async () => {
    const { id } = await note();
    const result = await db.query<Row>('UPDATE public.office_private_notes SET title = $1, revision = 2 WHERE id = $2 AND revision = 1 RETURNING *', ['New', id]);
    expect(result.rows[0].revision).toBe(2);
    expect((await db.query('UPDATE public.office_private_notes SET title = $1, revision = 2 WHERE id = $2 AND revision = 1 RETURNING id', ['Old', id])).rows).toEqual([]);
    await expect(db.query('UPDATE public.office_private_notes SET revision = 2 WHERE id = $1', [id])).rejects.toMatchObject({ code: '40001' });
    await expect(db.query('UPDATE public.office_private_notes SET revision = 4 WHERE id = $1', [id])).rejects.toMatchObject({ code: '40001' });
  });

  it('rejects attempts to change ownership, tenant, ID or creation timestamp', async () => {
    const { id } = await note();
    for (const mutation of [
      `owner_user_id = '${OTHER_USER}'`, `tenant_id = '${OTHER_TENANT}'`,
      "id = gen_random_uuid()", "created_at = '2000-01-01'",
    ]) {
      await expect(db.query(`UPDATE public.office_private_notes SET ${mutation}, revision = 2 WHERE id = $1`, [id])).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('rejects archived inserts and revisions other than 1', async () => {
    for (const extra of ["revision) VALUES ($1, $2, 2)", "archived_at) VALUES ($1, $2, now())"]) {
      await expect(db.query(`INSERT INTO public.office_private_notes(tenant_id, owner_user_id, ${extra}`, [TENANT, USER])).rejects.toMatchObject({ code: '22023' });
    }
  });

  it('archives with server time, restores with a revision and deletes only archived expected revisions', async () => {
    const { id } = await note();
    expect((await db.query('DELETE FROM public.office_private_notes WHERE id = $1 RETURNING id', [id])).rows).toEqual([]);
    const archived = (await db.query<Row>("UPDATE public.office_private_notes SET archived_at = '2000-01-01', updated_at = '2000-01-01', revision = 2 WHERE id = $1 AND revision = 1 RETURNING *", [id])).rows[0];
    expect(archived.archived_at?.getUTCFullYear()).not.toBe(2000);
    expect(archived.archived_at).toEqual(archived.updated_at);
    const restored = (await db.query<Row>('UPDATE public.office_private_notes SET archived_at = NULL, revision = 3 WHERE id = $1 AND revision = 2 RETURNING *', [id])).rows[0];
    expect(restored.archived_at).toBeNull();
    await db.query('UPDATE public.office_private_notes SET archived_at = now(), revision = 4 WHERE id = $1 AND revision = 3', [id]);
    expect((await db.query('DELETE FROM public.office_private_notes WHERE id = $1 AND revision = 3 RETURNING id', [id])).rows).toEqual([]);
    expect((await db.query('DELETE FROM public.office_private_notes WHERE id = $1 AND revision = 4 RETURNING id', [id])).rows).toEqual([{ id }]);
  });
});

describe('private Office notes SQL payload validation', () => {
  const invalidCases: [string, (content: typeof CONTENT) => void][] = [
    ['mind map cycles', (c) => { c.nodes[0].parentId = 'child'; }],
    ['missing mind map parents', (c) => { c.nodes[1].parentId = 'missing'; }],
    ['duplicate nested IDs', (c) => { c.nodes[1].id = 'root'; }],
    ['node coordinates outside the board', (c) => { c.nodes[1].x = 1001; }],
    ['stroke coordinates outside the board', (c) => { c.strokes[0].points = [[1, 601]]; }],
    ['malformed points', (c) => { c.strokes[0].points = [[1]]; }],
    ['empty strokes', (c) => { c.strokes[0].points = []; }],
    ['invalid width', (c) => { c.strokes[0].width = 0; }],
    ['invalid color', (c) => { c.strokes[0].color = 'url(javascript:bad)'; }],
    ['more than 30,000 points', (c) => { c.strokes[0].points = Array.from({ length: 30001 }, () => [1, 1]); }],
    ['more than 500 strokes', (c) => { c.strokes = Array.from({ length: 501 }, (_, i) => ({ id: String(i), color: '#000', width: 1, points: [[1, 1]] })); }],
    ['overlong text', (c) => { c.text = 'a'.repeat(100001); }],
    ['overlong structured values', (c) => { c.fields[0].value = 'a'.repeat(5001); }],
    ['unknown task status', (c) => { c.tasks[0].status = 'unknown'; }],
    ['malformed task date', (c) => { c.tasks[0].dueDate = 'not-a-date'; }],
    ['unsafe source scheme', (c) => { c.sources[0].url = 'javascript:alert(1)'; }],
    ['whitespace in source URL', (c) => { c.sources[0].url = 'https://example.org/a b'; }],
    ['missing required fields', (c) => { Reflect.deleteProperty(c, 'cues'); }],
  ];

  it.each(invalidCases)('rejects %s', async (_name, edit) => {
    const content = structuredClone(CONTENT);
    edit(content);
    await expect(insert(content)).rejects.toMatchObject({ code: '22023' });
  });

  it.each(['', ' ', '\t\r\n', '\v', '\f', '\u00a0', '\u2003', '\uFEFF'])('rejects empty or whitespace-only tag %j', async (tag) => {
    await expect(insert(CONTENT, [tag])).rejects.toMatchObject({ code: '22023' });
  });

  it('keeps valid tags and accepts a single-point stroke', async () => {
    const content = structuredClone(CONTENT);
    content.strokes[0].points = [[0, 0]];
    expect((await insert(content, ['v', ' normal ', '✓'])).rows).toHaveLength(1);
    await expect(insert(CONTENT, ['x'.repeat(41)])).rejects.toMatchObject({ code: '22023' });
  });

  it.each(['0001-01-01', '9999-12-31'])('accepts valid due date %s', async (date) => {
    expect((await insert(CONTENT, [], date)).rows).toHaveLength(1);
  });

  it.each(['10000-01-01', '0001-01-01 BC', 'infinity', '-infinity'])('rejects out-of-range due date %s', async (date) => {
    await expect(insert(CONTENT, [], date)).rejects.toMatchObject({ code: '23514' });
  });

  it.each(['', 'https://example.org', 'http://localhost:3000/a?b=1'])('accepts blank or HTTP(S) source %j', async (url) => {
    const content = structuredClone(CONTENT);
    content.sources[0].url = url;
    expect((await insert(content)).rows).toHaveLength(1);
  });

  it.each([' ', ' https://example.org', 'https://example.org '])('rejects untrimmed source %j', async (url) => {
    const content = structuredClone(CONTENT);
    content.sources[0].url = url;
    await expect(insert(content)).rejects.toMatchObject({ code: '22023' });
  });
});
