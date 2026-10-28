import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '@/types/office/broadcast';
const h = vi.hoisted(() => ({ detail: vi.fn(), markRead: vi.fn() }));
vi.mock('@/lib/office/notificationservice', () => ({ fetchBroadcastForNotification: h.detail, markNotificationRead: h.markRead }));
import { readClientPortalAnnouncement } from '@/lib/portal/clientAnnouncementReadService';

const item = { id: 'notification-1', relatedBroadcastId: 'broadcast-1', isRead: false, bodyPreview: 'Nur der Anfang…' } as AppNotification;
beforeEach(() => {
  vi.clearAllMocks();
  h.detail.mockResolvedValue({ ok: true, data: { body: 'Der vollständige Text der Mitteilung.' } });
  h.markRead.mockResolvedValue({ ok: true });
});
describe('client announcement full-read workflow', () => {
  it('does not write a read receipt after the originating portal scope has been left', async () => {
    let current = true;
    let finish!: (value: unknown) => void;
    h.detail.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = readClientPortalAnnouncement('tenant-1', 'user-1', item, undefined, { isCurrent: () => current });
    current = false;
    finish({ ok: true, data: { body: 'Volltext des alten Kontos' } });
    expect((await pending).ok).toBe(false);
    expect(h.markRead).not.toHaveBeenCalled();
  });
  it('does not start a full read for an already inactive origin', async () => {
    expect((await readClientPortalAnnouncement('tenant-1', 'user-1', item, undefined, { isCurrent: () => false })).ok).toBe(false);
    expect(h.detail).not.toHaveBeenCalled(); expect(h.markRead).not.toHaveBeenCalled();
  });
  it('marks read only after the complete authorized text was loaded', async () => {
    const result = await readClientPortalAnnouncement('tenant-1', 'user-1', item);
    expect(result).toEqual({ ok: true, data: { body: 'Der vollständige Text der Mitteilung.', readWarning: null } });
    expect(h.detail).toHaveBeenCalledWith('tenant-1', 'broadcast-1');
    expect(h.markRead).toHaveBeenCalledWith('tenant-1', 'notification-1', 'user-1');
    expect(h.detail.mock.invocationCallOrder[0]).toBeLessThan(h.markRead.mock.invocationCallOrder[0]);
  });
  it('does not mark a denied, expired or failed full text as read', async () => {
    h.detail.mockResolvedValue({ ok: false, error: 'Broadcast nicht gefunden.' });
    const result = await readClientPortalAnnouncement('tenant-1', 'user-1', item);
    expect(result.ok).toBe(false);
    expect(h.markRead).not.toHaveBeenCalled();
  });
  it('allows a real retry after a full text failure', async () => {
    h.detail.mockResolvedValueOnce({ ok: false, error: 'Network' });
    expect((await readClientPortalAnnouncement('tenant-1', 'user-1', item)).ok).toBe(false);
    expect((await readClientPortalAnnouncement('tenant-1', 'user-1', item)).ok).toBe(true);
    expect(h.markRead).toHaveBeenCalledTimes(1);
  });
  it('keeps the complete body readable when the read receipt fails', async () => {
    h.markRead.mockResolvedValue({ ok: false, error: 'Network' });
    const result = await readClientPortalAnnouncement('tenant-1', 'user-1', item);
    expect(result.ok && result.data).toMatchObject({ body: 'Der vollständige Text der Mitteilung.', readWarning: expect.any(String) });
  });
  it('keeps the complete body readable when storing the read receipt throws', async () => {
    h.markRead.mockRejectedValue(new Error('offline'));
    const result = await readClientPortalAnnouncement('tenant-1', 'user-1', item);
    expect(result.ok && result.data).toMatchObject({ body: 'Der vollständige Text der Mitteilung.', readWarning: expect.any(String) });
  });
  it('reports a removed broadcast link without pretending a preview is the full text', async () => {
    const result = await readClientPortalAnnouncement('tenant-1', 'user-1', { ...item, relatedBroadcastId: null });
    expect(result.ok).toBe(false);
    expect(h.detail).not.toHaveBeenCalled(); expect(h.markRead).not.toHaveBeenCalled();
  });
});
