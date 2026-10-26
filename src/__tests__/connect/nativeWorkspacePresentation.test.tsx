// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { helpArticlePrintHtml } from '@/features/help/helpArticlePrint.shared';
import { HELP_ARTICLES } from '@/features/help/helpCatalog';
import { NativeByteBlob } from '@/lib/platform/nativeByteBlob.shared';
import { nativeWorkspaceNodes } from '@/lib/platform/nativeWorkspaceNodes.shared';
import { createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
import { helpCenterCss } from '@/features/help/helpCenterCss';
import { workspaceCss } from '@/components/googleWorkspace/workspaceCss.native';
import { compileWorkspaceCss, resolveWorkspacePresentation, workspaceGridWidths } from '@/lib/platform/nativeWorkspaceStyles.shared';

// The actual generated native presentations run here. Only native hosts and
// providers are inert: these checks never read or change a Google account.
const api = {
  params: {} as Record<string, string>, role: 'business_admin', formHandle: null as any,
  workspaceLoading: false, workspaceError: null as string | null,
  push: vi.fn(), setParams: vi.fn(), close: vi.fn(), copy: vi.fn(), print: vi.fn(),
  connect: vi.fn(), disconnect: vi.fn(), refresh: vi.fn(), pageRefresh: vi.fn(),
  invoke: vi.fn(), edge: vi.fn(), statusRead: vi.fn(), pageRead: vi.fn(),
  section: { scrollIntoView: vi.fn(), focus: vi.fn() },
};
const connection = { status: 'connected', email: 'fixture@example.invalid', domain: null, connectedAt: '2026-10-26T10:00:00Z', lastSyncAt: null,
  capabilities: Object.fromEntries(['gmail','calendar','meet','drive','docs','sheets','slides','tasks','contacts','chat'].map(key => [key, true])) };
const tags = ['Div','Span','P','Strong','Section','H1','H2','H3','Nav','A','Pre','Label','Select','Option','Article','H4','Fieldset','Ul','Li','Ol','Details','Summary','Footer','Aside','Main','Header','Small'];
const nativeElements: Record<string, unknown> = Object.fromEntries(tags.map(tag => ['Native' + tag, (props: any) => React.createElement(tag.toLowerCase(), props, props.children)]));
Object.assign(nativeElements, {
  NativeForm: (props: any) => { const dom = React.useRef<HTMLFormElement>(null); React.useImperativeHandle(props.ref, () => api.formHandle ?? dom.current, [api.formHandle]); return <form {...props} ref={dom} />; },
  NativeButton: (props: any) => <button {...props} />,
  NativeInput: (props: any) => <input {...props} onInput={props.onChange} onChange={() => undefined} />,
  NativeTextarea: (props: any) => <textarea {...props} onInput={props.onChange} onChange={() => undefined} />,
  NativeStyle: () => null, NativeWorkspaceStyleScope: (props: any) => props.children,
});
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': { Platform: { OS: 'android' } },
  '@/components/layout/NativeWorkspaceElements.native': nativeElements,
  '@/lib/platform/nativeWorkspaceNodes.shared': { nativeWorkspaceNodes },
  '@/components/layout/NativeSvgPresentation.native': { NativeSvgPath: (props: any) => <path {...props} />, NativeSvgCircle: (props: any) => <circle {...props} /> },
  '../icons/WebActionIcon.native.tsx': { WebActionIcon: (props: any) => <svg>{props.children}</svg> },
  '@/components/layout/ScreenShell.tsx': { ScreenShell: (props: any) => props.children },
  '../../hooks/useWebBackNavigation.native.ts': { useWebBackNavigation: () => api.close },
  'expo-router': { useLocalSearchParams: () => api.params, useRouter: () => ({ push: api.push, setParams: api.setParams }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ roleKey: api.role, isReadOnly: false }) },
  '@/hooks/useTenantId': { useServiceTenantId: () => 'fixture-tenant' },
  '@/lib/auth/context': { useAuth: () => ({ profile: { id: 'fixture-user', tenantId: 'fixture-tenant', roleKey: 'business_admin' } }) },
  '@/hooks/core/useAsyncQuery': { useAsyncQuery: () => ({ data: null, loading: false, refreshing: false, error: null, refreshError: null, refresh: vi.fn() }) },
  '@/lib/clients/clientDocumentsService': { listClientDocuments: vi.fn(), uploadClientDocument: vi.fn() },
  '@/lib/services/mode': { getServiceMode: () => 'supabase' },
  '@/components/office/ClientDocumentPreview': { ClientDocumentPreview: () => <p>Lokale Dokumentvorschau</p> },
  '../documents/DocumentRecommendations.native.tsx': { DocumentRecommendations: () => null },
  './AcademyAuthorPreview.native.tsx': { AcademyAuthorPreview: () => null },
  'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true, assets: [] }) },
  '../../hooks/useGoogleWorkspace.native.ts': {
    useGoogleWorkspace: (enabled = true) => { api.statusRead(enabled); return { connection, loading: api.workspaceLoading, actionLoading: false, error: api.workspaceError, scope: 'fixture:tenant:business_admin', refresh: api.refresh, connect: api.connect, disconnect: api.disconnect }; },
    useWorkspacePage: (service: string, filter: unknown, enabled: boolean) => { api.pageRead(service, filter, enabled); return { data: { items: [], fetchedAt: '2026-10-26T10:00:00Z' }, loading: false, error: null, refresh: api.pageRefresh }; },
    refreshWorkspaceData: vi.fn(),
  },
  '@/lib/googleWorkspace/googleWorkspaceService': { invokeGoogleWorkspaceAction: api.invoke },
  '@/lib/supabase/edgeFunctions': { invokeEdgeFunction: api.edge },
  '@/features/help/nativeHelpArticlePrint.native': { printNativeHelpArticle: api.print },
  '@/lib/platform/nativeWorkflowEnvironment.native': { nativeCrypto: { randomUUID: () => 'fixture-request-id' }, nativeURL: URL, nativeNavigator: { clipboard: { writeText: api.copy } }, nativeDocument: { getElementById: () => api.section }, useNativeWorkflowWindow: () => ({ addEventListener() {}, removeEventListener() {} }) },
};
const bundle = buildSync({ stdin: { contents: "export { HelpCenterScreen } from './src/screens/help/HelpCenterScreen.native'; export { WorkspaceDashboard } from './src/components/googleWorkspace/WorkspaceDashboard.native'; export { WorkspaceServicePanel } from './src/components/googleWorkspace/WorkspaceServicePanel.native'; export { WorkspaceActionForm } from './src/components/googleWorkspace/WorkspaceActionForm.native'; export { GoogleWorkspaceWidget } from './src/components/googleWorkspace/GoogleWorkspaceWidget.native'; export { AcademyCourseEditor } from './src/features/akademie/AcademyCourseEditor.native'; export { ClientRecordDocumentsPanel } from './src/components/office/ClientRecordDocumentsPanel.native';", loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', bundle)((key: string) => { if (!(key in dependencies)) throw Error(`Unexpected native presentation dependency: ${key}`); return dependencies[key]; }, loaded, loaded.exports);
const { HelpCenterScreen, WorkspaceDashboard, WorkspaceServicePanel, WorkspaceActionForm, GoogleWorkspaceWidget, AcademyCourseEditor, ClientRecordDocumentsPanel } = loaded.exports;
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); api.params = {}; api.role = 'business_admin'; api.formHandle = null;
  api.workspaceLoading = false; api.workspaceError = null;
  api.invoke.mockResolvedValue({ id: 'fixture-resource' }); api.edge.mockResolvedValue({ ok: true, data: { events: [] } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const click = async (text: string) => { const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text)); expect(button, text).toBeTruthy(); await act(async () => button!.click()); };
const fill = async (name: string, value: string) => { const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!; expect(field, name).toBeTruthy(); await act(async () => { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }); };
const submit = async () => { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); };

describe('native help and Google presentations from their Web source', () => {
  it.each([[248, 28, 9], [826, 34, 13]])('reserves the Help number track and remaining text width inside %dpx', (available, numberWidth, gap) => {
    const sheet = compileWorkspaceCss(helpCenterCss), ancestors = [{ tag: 'main', props: { className: 'cs-help' } }, { tag: 'ol', props: { className: 'hh-steps' } }];
    const row = resolveWorkspacePresentation([sheet], { tag: 'li', props: {} }, ancestors, available);
    expect(workspaceGridWidths(row.grid!, available, gap, 1.6)).toEqual([numberWidth, available - numberWidth - gap]);
    expect(resolveWorkspacePresentation([sheet], { tag: 'li', props: {}, pseudo: 'before' }, ancestors, available).declarations.content).toBeUndefined();
    const badge = resolveWorkspacePresentation([sheet], { tag: 'span', props: { className: 'hh-step-number' } }, [...ancestors, { tag: 'li', props: {} }], available);
    expect(badge.box.width).toBe(numberWidth);
  });
  it('allows the Google service identity to shrink and wrap within a 320px screen', () => {
    const sheet = compileWorkspaceCss(workspaceCss), root = { tag: 'section', props: { className: 'cs-workspace' } };
    const identity = resolveWorkspacePresentation([sheet], { tag: 'div', props: { className: 'cs-w-row cs-w-service-identity' } }, [root], 254);
    expect(identity.box.flexGrow).toBe(1); expect(identity.box.flexShrink).toBe(1); expect(identity.box.maxWidth).toBe('100%');
    const title = resolveWorkspacePresentation([sheet], { tag: 'div', props: { className: 'cs-w-service-title' } }, [root], 208);
    expect(title.box.flex).toBe(1); expect(title.box.minWidth).toBe(0);
  });
  it('retains help journeys, article links, clipboard and native print handoff', async () => {
    await render(<HelpCenterScreen />);
    expect(host.textContent).toContain('Ein Ablauf, Schritt für Schritt');
    expect(host.querySelectorAll('.hh-card').length).toBeGreaterThan(10);
    await click('Logo hochladen'); expect(api.setParams).toHaveBeenCalledWith(expect.objectContaining({ q: 'Logo hochladen' }));
    api.params = { artikel: 'dokument-logo' }; await render(<HelpCenterScreen />);
    await click('Link kopieren'); expect(api.copy).toHaveBeenCalledWith('https://www.caresuiteplus.app/hilfe?artikel=dokument-logo');
    await click('Drucken / PDF'); expect(api.print).toHaveBeenCalledWith(expect.objectContaining({ id: 'dokument-logo' }));
    await act(async () => host.querySelector<HTMLAnchorElement>('a[href$="-steps"]')!.click());
    expect(api.section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }); expect(api.section.focus).toHaveBeenCalledOnce();
    const steps = [...host.querySelectorAll('.hh-steps > li')];
    expect(steps).toHaveLength(5);
    for (const [index, step] of steps.entries()) {
      expect(step.children).toHaveLength(2);
      expect(step.children[0].className).toBe('hh-step-number');
      expect(step.children[0].textContent).toBe(String(index + 1).padStart(2, '0'));
      expect(step.children[1].querySelector('h3')?.textContent).toBeTruthy();
      expect(step.children[1].querySelector('p')?.textContent).toBeTruthy();
    }
    await click('Bereich öffnen'); expect(api.push).toHaveBeenCalledWith('/business/templates/ci-layout');
    await click('Zurück zur Arbeit'); expect(api.close).toHaveBeenCalledOnce();
  });
  it('focuses Academy publication settings through a native field without DOM validity', async () => {
    const field = { value: '0', valid: vi.fn(() => false), focus: vi.fn(), scrollIntoView: vi.fn() };
    api.formHandle = { querySelectorAll: () => [field], querySelector: () => field };
    const content = createAcademyTemplate('blank'); content.title = 'Schulung'; content.summary = 'Ein klares Lernziel.'; content.estimatedMinutes = 0;
    await render(<AcademyCourseEditor course={null} draftId="fixture-course" initialContent={content} busy={false} onCommand={vi.fn()} onClose={vi.fn()} />);
    await click('Prüfen Sie Zeitbedarf');
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(field.valid).toHaveBeenCalled(); expect(field.focus).toHaveBeenCalledOnce();
  });
  it('returns from a document preview using the exact scoped native row handle without CSS.escape', async () => {
    const document = { id: 'record-"quoted\\id', tenantId: 'fixture-tenant', clientId: 'fixture-client', title: 'Originalunterlage', fileName: 'Originalunterlage.pdf', mimeType: 'application/pdf', documentSource: 'upload', status: 'abgeschlossen', createdAt: '2026-10-26T10:00:00Z', updatedAt: '2026-10-26T10:00:00Z', category: 'sonstiges' };
    const focus = vi.fn(), release = nativeWorkspaceNodes.register('native-client-document-' + JSON.stringify([document.tenantId, document.clientId, document.id]), { focus });
    try {
      await render(<ClientRecordDocumentsPanel clientId="fixture-client" initialDocuments={[document]} />);
      await click('Originalunterlage'); expect(host.textContent).toContain('Lokale Dokumentvorschau');
      await click('Zur Dokumentenliste'); await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
      expect(focus).toHaveBeenCalledOnce(); expect(host.textContent).not.toContain('Lokale Dokumentvorschau');
    } finally { release(); }
  });
  it('builds a complete escaped native print document without DOM cloning', () => {
    const article = HELP_ARTICLES.find(item => item.id === 'dokument-logo')!;
    const html = helpArticlePrintHtml({ ...article, title: '<script>Test</script>' });
    expect(html).toContain('&lt;script&gt;Test&lt;/script&gt;'); expect(html).not.toContain('<script>');
    for (const step of article.steps) expect(html).toContain(step.title);
    for (const item of article.troubleshooting) expect(html).toContain(item.problem);
    expect(html).toContain('Zum Abschluss prüfen');
  });
  it('retains the native OAuth callbacks and requires an explicit disconnect confirmation', async () => {
    await render(<WorkspaceDashboard callbackResult="connected" />);
    expect(api.refresh).toHaveBeenCalledOnce(); expect(host.querySelectorAll('.cs-w-service-card')).toHaveLength(10);
    await click('Freigaben verwalten'); expect(api.connect).toHaveBeenCalledOnce();
    await click('Verbindung trennen'); expect(api.disconnect).not.toHaveBeenCalled();
    await click('Jetzt trennen'); expect(api.disconnect).toHaveBeenCalledOnce();
  });
  it('keeps the multi-digit Google permission count in one native text flow', async () => {
    await render(<WorkspaceDashboard callbackResult="connected" />);
    const notice = host.querySelector('.cs-w-notice.success')!, pill = [...host.querySelectorAll('.cs-w-pill')].find(item => item.textContent === '10 von 10 Diensten freigegeben')!;
    expect(notice.textContent).toBe('Google-Konto erfolgreich verbunden. 10 Dienste sind freigegeben.');
    expect(pill).toBeTruthy();
    // Each primitive child becomes a separate Text in a native flex/block host.
    // Keeping the number in the same child lets the full sentence wrap together.
    expect(notice.childNodes).toHaveLength(1); expect(pill.childNodes).toHaveLength(1);
  });
  it('preserves Google loading, provider error recovery and callback failure states', async () => {
    api.workspaceLoading = true; await render(<WorkspaceDashboard />);
    expect(host.querySelector('.cs-w-pill')?.textContent).toBe('Status wird geladen …');
    expect(host.querySelector('.cs-w-notice.success')).toBeNull();
    api.workspaceLoading = false; api.workspaceError = 'Lokale Statusprüfung fehlgeschlagen.'; await render(<WorkspaceDashboard callbackResult="error" />);
    expect(host.querySelector('.cs-w-pill')?.textContent).toBe('Status nicht bestätigt');
    expect(host.textContent).toContain('Google-Freigabe nicht abgeschlossen');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Google-Freigabe nicht abgeschlossen');
    expect(host.textContent).toContain('Lokale Statusprüfung fehlgeschlagen.');
    await click('Erneut laden'); expect(api.refresh).toHaveBeenCalledTimes(2);
    expect(api.connect).not.toHaveBeenCalled(); expect(api.disconnect).not.toHaveBeenCalled();
  });
  it('does not request Google widget data for a role without access', async () => {
    api.role = 'employee'; await render(<GoogleWorkspaceWidget service="gmail" />);
    expect(api.statusRead).toHaveBeenLastCalledWith(false);
    expect(api.pageRead.mock.calls.at(-1)?.[2]).toBe(false);
    expect(host.textContent).toContain('Für Geschäftsführung und Verwaltung');
  });
  it('uses controlled native date filters and rejects an inverted interval', async () => {
    await render(<WorkspaceServicePanel service="calendar" connection={connection} scope="fixture:tenant:business_admin" />);
    await fill('from', '2026-10-26'); await fill('to', '2026-10-25'); await submit();
    expect(host.textContent).toContain('Das Ende muss am oder nach dem Beginn liegen.');
    expect(api.invoke).not.toHaveBeenCalled();
    await fill('to', '2026-10-27'); await submit();
    expect(api.pageRead.mock.calls.at(-1)?.[1]).toEqual({ query: '', from: '2026-10-26', to: '2026-10-27', pageToken: undefined });
  });
  it('opens the native calendar form through a vector action icon and bounded service identity', async () => {
    await render(<WorkspaceServicePanel service="calendar" connection={connection} scope="fixture:tenant:business_admin" />);
    const identity = host.querySelector('.cs-w-service-identity')!;
    expect(identity.querySelector('.cs-w-service-title h2')?.textContent).toBe('Kalender');
    expect(identity.querySelector('.cs-w-service-title p')?.textContent).toBe('Termine im gewählten Zeitraum und neue Veranstaltungen.');
    const action = [...host.querySelectorAll('button')].find(button => button.textContent === 'Neu erstellen')!;
    expect(action.querySelector('svg path')?.getAttribute('d')).toBe('M12 5v14M5 12h14');
    expect(action.textContent).not.toContain('＋');
    await act(async () => action.click());
    expect(host.textContent).toContain('Termin anlegen');
    expect(api.invoke).not.toHaveBeenCalled();
    await click('Abbrechen'); expect(host.textContent).not.toContain('Termin anlegen');
  });
  it('passes the controlled native Gmail draft to an inert provider with unchanged UTF-8 content', async () => {
    await render(<WorkspaceActionForm service="gmail" onSaved={vi.fn()} onCancel={vi.fn()} />);
    await fill('to', 'fixture@example.invalid'); await fill('title', 'Prüfung'); await fill('body', 'Grüße aus Köln');
    await click('Als Entwurf speichern');
    expect(api.invoke).toHaveBeenCalledOnce(); const [action, payload, write] = api.invoke.mock.calls[0];
    expect(action).toBe('gmail_draft'); expect(write).toBe(true);
    const mail = atob(payload.raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(new TextDecoder().decode(Uint8Array.from(atob(mail.split('\r\n\r\n')[1]), char => char.charCodeAt(0)))).toBe('Grüße aus Köln');
  });
  it('retains the native file size limit and forwards exact uploaded bytes through the inert provider', async () => {
    await render(<WorkspaceActionForm service="drive" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
    const pick = async (file: { name?: string; size: number; type: string; arrayBuffer?: () => Promise<ArrayBuffer> }) => { await act(async () => { Object.defineProperty(input, 'files', { configurable: true, value: [file] }); input.dispatchEvent(new Event('input', { bubbles: true })); }); };
    await pick({ name: 'oversized.txt', size: 5 * 1024 * 1024 + 1, type: 'text/plain' }); await submit();
    expect(host.textContent).toContain('Die Datei darf höchstens 5 MB groß sein.'); expect(api.invoke).not.toHaveBeenCalled();
    const bytes = Uint8Array.from([0, 255, 128, 13, 10, 1, 240]);
    const picked = NativeByteBlob.fromDisk({ uri: 'file:///fixture-bytes.bin', name: 'bytes.bin', size: bytes.length, type: 'application/octet-stream', arrayBuffer: async () => bytes.buffer });
    const truncated = NativeByteBlob.fromDisk({ uri: 'file:///fixture-truncated.bin', name: 'truncated.bin', size: bytes.length, type: 'application/octet-stream', arrayBuffer: async () => bytes.slice(0, 2).buffer });
    await pick(truncated); await submit(); expect(host.textContent).toContain('Die Datei wurde nicht vollständig gelesen.'); expect(api.invoke).not.toHaveBeenCalled();
    await pick(picked); await submit();
    expect(api.invoke).toHaveBeenCalledWith('drive_upload', { name: 'bytes.bin', mimeType: 'application/octet-stream', base64: btoa(String.fromCharCode(...bytes)) }, true);
  });
  it('retains a rejected native draft, reports failure and retries without calling onSaved early', async () => {
    const saved = vi.fn(); api.invoke.mockRejectedValueOnce(new Error('Fixture-Anfrage fehlgeschlagen')).mockResolvedValueOnce({ id: 'fixture-draft' });
    await render(<WorkspaceActionForm service="gmail" onSaved={saved} onCancel={vi.fn()} />);
    await fill('to', 'fixture@example.invalid'); await fill('title', 'Entwurf'); await fill('body', 'Diese Eingabe bleibt erhalten.');
    await click('Als Entwurf speichern');
    expect(saved).not.toHaveBeenCalled(); expect(host.textContent).toContain('Fixture-Anfrage fehlgeschlagen');
    expect(host.querySelector<HTMLTextAreaElement>('[name=body]')!.value).toBe('Diese Eingabe bleibt erhalten.');
    await click('Als Entwurf speichern'); expect(api.invoke).toHaveBeenCalledTimes(2); expect(saved).toHaveBeenCalledOnce();
  });
  it('rejects reversed native event times before invoking the inert provider', async () => {
    await render(<WorkspaceActionForm service="calendar" onSaved={vi.fn()} onCancel={vi.fn()} />);
    await fill('title', 'Fixture'); await fill('start', '2026-10-26T10:00'); await fill('end', '2026-10-26T09:00'); await submit();
    expect(host.textContent).toContain('Das Ende muss nach dem Beginn liegen.'); expect(api.invoke).not.toHaveBeenCalled();
    await fill('end', '2026-10-26T11:00'); await submit();
    expect(api.invoke).toHaveBeenCalledWith('calendar_create', { requestId: 'fixture-request-id', createMeet: false, sendUpdates: 'all', event: { summary: 'Fixture', description: '', start: { dateTime: new Date('2026-10-26T10:00').toISOString() }, end: { dateTime: new Date('2026-10-26T11:00').toISOString() } } }, true);
  });
});
