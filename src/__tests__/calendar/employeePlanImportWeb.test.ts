import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ pick: vi.fn(), read: vi.fn() }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('@/lib/calendar/localPlanReader', () => ({ readLocalPlan: mocks.read }));
import { importEmployeePlan } from '@/lib/calendar/employeePlanImport.web';
const input = { tenantId: 'tenant', employeeId: 'employee', employeeName: 'Alex Muster', month: '2026-10', employer: '', interpretation: 'external' as const };
beforeEach(() => {
  mocks.pick.mockReset(); mocks.read.mockReset();
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ name: 'plan.pdf', file: new File(['%PDF-'], 'plan.pdf'), size: 5 }] });
  mocks.read.mockResolvedValue({ text: 'Oktober 2026\n01.10.2026 8-12', pages: 1, ocrPages: 0, lowConfidence: false });
});
describe('web plan import boundary', () => {
  it('reads a selected File locally and returns an unsaved editable draft', async () => {
    const controller = new AbortController(); const onProgress = vi.fn();
    const result = await importEmployeePlan({ ...input, signal: controller.signal, onProgress });
    expect(mocks.read.mock.calls[0][0]).toBeInstanceOf(File);
    expect(mocks.read.mock.calls[0][1].signal).toBe(controller.signal);
    expect(result?.rows[0]).toMatchObject({ date: '2026-10-01', startTime: '08:00', endTime: '12:00', kind: 'blocked' });
    expect(result?.extractedText).toContain('01.10.2026');
  });
  it('flags OCR drafts and gives a quality warning', async () => {
    mocks.read.mockResolvedValue({ text: '01.10.2026 8-12', pages: 1, ocrPages: 1, lowConfidence: true });
    const result = await importEmployeePlan(input); expect(result?.rows[0].uncertain).toBe(true); expect(result?.warnings.join(' ')).toContain('Bildqualität');
  });
  it('does nothing after picker cancellation', async () => { mocks.pick.mockResolvedValue({ canceled: true }); expect(await importEmployeePlan(input)).toBeNull(); expect(mocks.read).not.toHaveBeenCalled(); });
  it('never fetches a remote URL when no local File is available', async () => {
    mocks.pick.mockResolvedValue({ canceled: false, assets: [{ name: 'plan.pdf', uri: 'https://example.test/private.pdf' }] });
    await expect(importEmployeePlan(input)).rejects.toThrow(/lokal gelesen/); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('rejects oversize inputs before OCR', async () => { mocks.pick.mockResolvedValue({ canceled: false, assets: [{ size: 11 * 1024 * 1024 }] }); await expect(importEmployeePlan(input)).rejects.toThrow(/10 MB/); expect(mocks.read).not.toHaveBeenCalled(); });
  it('propagates cancellation without producing a draft', async () => { const c = new AbortController(); c.abort(); await expect(importEmployeePlan({ ...input, signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(mocks.read).not.toHaveBeenCalled(); });
});
