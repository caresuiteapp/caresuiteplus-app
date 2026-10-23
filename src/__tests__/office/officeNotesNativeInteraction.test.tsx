// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteDraft } from '@/lib/office/notes/model.shared';
import type { NotesActor, OfficeNote } from '@/lib/office/notes/types.web';

const actor: NotesActor = { tenantId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222', roleKey: 'business_admin', permissions: ['office.access'] };
const api = { list: vi.fn(), save: vi.fn(), archive: vi.fn(), delete: vi.fn(), alert: vi.fn(), counter: 0 };
const Box = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>;
const native = {
  View: Box, ScrollView: Box, SafeAreaView: Box, KeyboardAvoidingView: Box, ActivityIndicator: () => <span>Loading</span>,
  Text: Box, TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={e => p.onChangeText(e.currentTarget.value)} />,
  Pressable: (p: any) => <button aria-label={p.accessibilityLabel} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  Platform: { OS: 'android' }, Alert: { alert: api.alert }, PanResponder: { create: () => ({ panHandlers: {} }) }, StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  'react-native-safe-area-context': { SafeAreaView: Box }, 'expo-linear-gradient': { LinearGradient: Box }, '@expo/vector-icons/Feather': { __esModule: true, default: () => null },
  'expo-crypto': { randomUUID: () => `33333333-3333-4333-8333-${String(++api.counter).padStart(12, '0')}` },
  'react-native-svg': { __esModule: true, default: Box, Line: () => null, Path: () => null, Rect: () => null, Text: () => null },
  '@/components/layout/ScreenShell': { ScreenShell: Box }, '@/lib/auth/context': { useAuth: () => ({ user: { id: actor.userId } }) }, '@/hooks/usePermissions': { usePermissions: () => ({}) },
  '@/lib/office/notes/service.shared': { listNotes: api.list, saveNote: api.save, setNoteArchived: api.archive, deleteNote: api.delete },
};
const code = buildSync({ entryPoints: ['src/screens/office/OfficeNotesScreen.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', code)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; }, loaded, loaded.exports);
const Notes = loaded.exports.NativeNotes;
const note = (extra: Partial<OfficeNote> = {}): OfficeNote => ({ ...createNoteDraft(), title: 'Teamrunde', id: '44444444-4444-4444-8444-444444444444', tenantId: actor.tenantId, ownerUserId: actor.userId, revision: 3, createdAt: '2026-10-23T08:00:00Z', updatedAt: '2026-10-23T09:00:00Z', archivedAt: null, ...extra });
let host: HTMLDivElement, root: Root;
const click = async (label: string) => { const button = [...(host.querySelector('[role="dialog"]') ?? host).querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label); expect(button, label).toBeTruthy(); await act(async () => button!.click()); };
const fill = async (label: string, value: string) => { const input = host.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!; expect(input).toBeTruthy(); await act(async () => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
const render = async (key = 'a', value = actor) => { await act(async () => root.render(<Notes key={key} actor={value} />)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.counter = 0;
  api.list.mockResolvedValue({ ok: true, data: [] }); api.save.mockResolvedValue({ ok: false, error: 'Keine Verbindung. Der Entwurf bleibt erhalten.' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native personal Office notes', () => {
  it('creates contact templates with native secure IDs and saves the actual form content', async () => {
    api.save.mockImplementation(async (_actor: NotesActor, operation: any) => ({ ok: true, data: { ...note(), ...operation.draft, id: operation.id, revision: 1 } }));
    await render(); await click('Neue Notiz'); await click('Kontakt erstellen'); await fill('Titel', 'Rückruf'); await fill('Name', 'Marlene Beispiel'); await fill('Notiztext', 'Am Dienstag zurückrufen.'); await click('Notiz speichern');
    expect(api.save).toHaveBeenCalledWith(actor, expect.objectContaining({ expectedRevision: null, draft: expect.objectContaining({ title: 'Rückruf', content: expect.objectContaining({ text: 'Am Dienstag zurückrufen.', fields: expect.arrayContaining([expect.objectContaining({ label: 'Name', value: 'Marlene Beispiel' })]) }) }) }));
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(host.textContent).toContain('Notiz gespeichert.');
  });
  it('retains a failed draft and retries the same UUID and revision', async () => {
    await render(); await click('Neue Notiz'); await click('Leere Notiz erstellen'); await fill('Titel', 'Entwurf'); await fill('Notiztext', 'Diesen Inhalt behalten'); await click('Notiz speichern');
    expect(host.textContent).toContain('Der Entwurf bleibt erhalten'); expect(host.querySelector<HTMLInputElement>('[aria-label="Notiztext"]')!.value).toBe('Diesen Inhalt behalten');
    await click('Notiz speichern'); expect(api.save.mock.calls[1][1]).toEqual(api.save.mock.calls[0][1]);
  });
  it('preserves shared revision conflict protection in the native editor', async () => {
    api.list.mockResolvedValue({ ok: true, data: [note()] }); api.save.mockResolvedValue({ ok: false, conflict: true, error: 'Die Notiz wurde zwischenzeitlich geändert.' });
    await render(); await click('Teamrunde öffnen'); await fill('Titel', 'Geänderte Teamrunde'); await click('Notiz speichern');
    expect(api.save.mock.calls[0][1]).toMatchObject({ id: note().id, expectedRevision: 3 }); expect(host.textContent).toContain('zwischenzeitlich geändert');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Titel"]')!.value).toBe('Geänderte Teamrunde');
  });
  it('requires an explicit discard action before closing an unsaved editor', async () => {
    await render(); await click('Neue Notiz'); await click('Leere Notiz erstellen'); await fill('Titel', 'Behalten'); await click('Abbrechen');
    expect(host.querySelector('[role="dialog"]')).toBeTruthy(); expect(api.alert).toHaveBeenCalled();
    await act(async () => api.alert.mock.calls[0][2][1].onPress()); expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(api.save).not.toHaveBeenCalled();
  });
  it('archives a note using its current revision and only deletes from the archive after confirmation', async () => {
    const original = note(), archived = note({ revision: 4, archivedAt: '2026-10-23T10:00:00Z' });
    api.list.mockResolvedValue({ ok: true, data: [original] }); api.archive.mockResolvedValue({ ok: true, data: archived }); api.delete.mockResolvedValue({ ok: true, data: { id: archived.id } });
    await render(); await click('Archivieren'); expect(api.archive).toHaveBeenCalledWith(actor, original, true); await click('Archiv'); await click('Löschen'); expect(api.delete).not.toHaveBeenCalled();
    await act(async () => api.alert.mock.calls[0][2][1].onPress()); expect(api.delete).toHaveBeenCalledWith(actor, archived.id, 4); expect(host.textContent).not.toContain('Teamrunde');
  });
  it('ignores a late response belonging to a previous account', async () => {
    let complete!: (value: unknown) => void;
    api.list.mockReturnValueOnce(new Promise(resolve => { complete = resolve; })); await render();
    const other = { ...actor, userId: '55555555-5555-4555-8555-555555555555' }; await render('b', other);
    await act(async () => complete({ ok: true, data: [note()] })); expect(host.textContent).not.toContain('Teamrunde'); expect(api.list).toHaveBeenLastCalledWith(other);
  });
});
