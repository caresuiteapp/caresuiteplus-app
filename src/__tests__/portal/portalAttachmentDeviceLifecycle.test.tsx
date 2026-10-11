// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficeMessageAttachmentPicker } from '@/components/office/officemessageattachmentpicker';
import { MessageAttachmentList } from '@/components/office/messageattachmentlist';
import { PortalDeviceSettingsCard } from '@/components/auth/PortalDeviceSettingsCard';
const h = vi.hoisted(() => ({
  camera: vi.fn(), library: vi.fn(), document: vi.fn(), bytes: vi.fn(), release: vi.fn(), error: vi.fn(),
  list: vi.fn(), url: vi.fn(), openURL: vi.fn(), push: vi.fn(), metadata: vi.fn(), background: vi.fn(), attachments: [] as any[],
}));
vi.mock('react-native', () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return { View: Box, Text: Box, Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) =>
    <button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled}>{children}</button>,
    ActivityIndicator: () => <span>Loading</span>, useWindowDimensions: () => ({ width: 390 }),
    Linking: { openURL: h.openURL, openSettings: vi.fn().mockResolvedValue(undefined) },
    Platform: { OS: 'android' }, StyleSheet: { create: (styles: any) => styles } };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: null, portalSession: { roleKey: 'employee_portal', accountId: 'account-a' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant-a' }));
vi.mock('@/lib/portal/employeePortalMediaPicker', () => ({
  openEmployeePortalCamera: h.camera, openEmployeePortalMediaLibrary: h.library,
  openEmployeePortalDocumentPicker: h.document, readEmployeePortalMediaBytes: h.bytes, releaseEmployeePortalMediaUri: h.release,
}));
vi.mock('@/lib/office/messageattachmentservice', () => ({ listMessageAttachments: h.list, resolveMessageAttachmentUrl: h.url }));
vi.mock('@/lib/portal/portalPushNotifications', () => ({ ensurePortalPushRegistration: h.push, toPortalPushUserMessage: () => 'Benachrichtigungen konnten noch nicht verbunden werden.' }));
vi.mock('@/lib/auth/rememberedPortalLogin', () => ({ getRememberedPortalMetadata: h.metadata, forgetRememberedPortalLogin: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/offline/portalBackgroundRefresh', () => ({ portalBackgroundRefreshStatus: h.background }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: { violet: '#00F', muted: '#666' } }) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ colors: {}, typography: { body: {}, caption: {} } }) }));
vi.mock('@/design/tokens/auroraGlass', () => ({ auroraGlass: {}, darkGlassSurfaceText: {}, surfaceContrastText: () => ({ primary: '#000' }) }));
vi.mock('@/design/tokens/portalPremium', () => ({ portalPremium: { text: { primary: '#000', secondary: '#333' } } }));
vi.mock('@/theme', () => ({ typography: {}, spacing: { xs: 4, sm: 8, md: 16 }, radius: { md: 12 } }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title, onPress, disabled, loading }: any) => <button onClick={onPress} disabled={disabled || loading}>{title}</button> }));
vi.mock('@/components/office/voicependingpreview', () => ({ VoicePendingPreview: () => null }));
vi.mock('@/components/office/voicemessageattachmentplayer', () => ({ VoiceMessageAttachmentPlayer: () => null }));
vi.mock('@/components/communication/MessageStatusTicks', () => ({ MessageStatusTicks: () => null }));
vi.mock('@/components/images/CareSuiteImage', () => ({ CareSuiteImage: () => null }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: ({ visible, children }: any) => visible ? <div>{children}</div> : null }));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
let root: Root, host: HTMLDivElement;
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label || item.textContent === label);
  expect(button, label).toBeDefined(); await act(async () => button!.click());
};
function PickerProbe() {
  const [attachments, setAttachments] = useState<any[]>([{ id: 'existing', fileName: 'Alt.pdf', mimeType: 'application/pdf', fileSizeBytes: 2 }]);
  h.attachments = attachments;
  return <OfficeMessageAttachmentPicker compact attachments={attachments} onChange={setAttachments} onError={h.error} />;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.camera.mockResolvedValue({ ok: true, media: null }); h.library.mockResolvedValue({ ok: true, media: null });
  h.document.mockResolvedValue({ ok: true, media: { uri: 'blob:file', fileName: 'Neu.pdf', mimeType: 'application/pdf', sizeBytes: 2 } });
  h.bytes.mockResolvedValue(new Uint8Array([1, 2])); h.list.mockResolvedValue({ ok: true, data: [] });
  h.url.mockResolvedValue({ ok: true, data: 'https://example.test/attachment' });
  h.openURL.mockResolvedValue(undefined);
  h.metadata.mockResolvedValue(null); h.background.mockResolvedValue('available'); h.push.mockResolvedValue({ ok: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('portal attachment and device controls', () => {
  it('does not reopen a parallel picker or restore an attachment removed during file reading', async () => {
    const bytes = deferred<Uint8Array>(); h.bytes.mockReturnValueOnce(bytes.promise);
    await render(<PickerProbe />); await press('Anhang hinzufügen'); await press('Kamera öffnen');
    expect(h.document).toHaveBeenCalledTimes(1); expect(h.camera).not.toHaveBeenCalled();
    await press('Entfernen'); expect(h.attachments).toEqual([]);
    await act(async () => bytes.resolve(new Uint8Array([1, 2, 3])));
    expect(h.attachments).toHaveLength(1); expect(h.attachments[0]).toMatchObject({ fileName: 'Neu.pdf', fileSizeBytes: 3 });
    expect(h.release).toHaveBeenCalledWith('blob:file');
  });
  it('rejects real oversize bytes even when file metadata understated the size', async () => {
    h.bytes.mockResolvedValueOnce(new Uint8Array(11 * 1024 * 1024)); await render(<PickerProbe />); await press('Anhang hinzufügen');
    expect(h.attachments.map((item) => item.id)).toEqual(['existing']); expect(h.error).toHaveBeenCalledWith(expect.stringContaining('maximal 10 MB'));
  });
  it('displays an actionable attachment-list failure beside a text message and loads it on retry', async () => {
    h.list.mockResolvedValueOnce({ ok: false, error: 'Offline' });
    await render(<MessageAttachmentList messageId="message-a" />);
    expect(host.textContent).toContain('Anhänge konnten nicht geladen');
    h.list.mockResolvedValueOnce({ ok: true, data: [{ id: 'file', fileName: 'Datei.pdf', mimeType: 'application/pdf', fileSizeBytes: 100 }] });
    await press('Anhänge erneut laden'); expect(host.textContent).toContain('Datei.pdf'); expect(h.list).toHaveBeenCalledTimes(2);
  });
  it('resolves every URL in a multiple-attachment message without relying on synchronous React updaters', async () => {
    h.list.mockResolvedValueOnce({ ok: true, data: ['one', 'two', 'three'].map((id) => ({ id, fileName: `${id}.pdf`, mimeType: 'application/pdf', fileSizeBytes: 100 })) });
    await render(<MessageAttachmentList messageId="message-a" />); expect(h.url).toHaveBeenCalledTimes(3);
  });
  it('shows an external file-open failure and retries with a newly resolved URL', async () => {
    h.list.mockResolvedValueOnce({ ok: true, data: [{ id: 'file', fileName: 'Datei.pdf', mimeType: 'application/pdf', fileSizeBytes: 100 }] });
    h.openURL.mockRejectedValueOnce(new Error('No handler'));
    await render(<MessageAttachmentList messageId="message-a" />); await press('Anhang öffnen: Datei.pdf');
    expect(host.textContent).toContain('Anhang nicht verfügbar');
    await press('Anhang öffnen: Datei.pdf');
    expect(h.openURL).toHaveBeenCalledTimes(2); expect(h.url).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toContain('Anhang nicht verfügbar');
  });
  it('recovers from rejected push registration and a failed background-status request with a retry', async () => {
    h.background.mockRejectedValueOnce(new Error('Native status unavailable')); h.push.mockRejectedValueOnce(new Error('Offline'));
    await render(<PortalDeviceSettingsCard />); await press('Benachrichtigungen einrichten / prüfen');
    expect(host.textContent).toContain('Benachrichtigungen konnten noch nicht verbunden');
    await press('Benachrichtigungen einrichten / prüfen'); expect(h.push).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Dieses Gerät ist für Benachrichtigungen registriert.');
  });
});
