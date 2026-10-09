import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ invoke: vi.fn(), mode: 'supabase' }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: api.invoke }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => api.mode }));
import { requestBusinessPasswordReset, completeBusinessPasswordReset } from '@/lib/auth/passwordResetService.native';
import { extractNativeBusinessRecoveryToken } from '@/lib/auth/businessRecoveryToken';
const token = 'a'.repeat(64);
beforeEach(() => { api.invoke.mockReset(); api.mode = 'supabase'; });
describe('native administration recovery', () => {
  it('requests an app link through the same role-restricted systemmail endpoint', async () => {
    api.invoke.mockResolvedValue({ ok: true, data: { message: 'Neutrale Bestätigung' } });
    expect((await requestBusinessPasswordReset(' ADMIN@example.test ')).ok).toBe(true);
    expect(api.invoke).toHaveBeenCalledWith('business-password-recovery', { action: 'request', email: 'admin@example.test', delivery: 'native' });
  });
  it('requires explicit backend acknowledgement and keeps a retry possible', async () => {
    api.invoke.mockResolvedValueOnce({ ok: false, error: 'Unterbrochen' }).mockResolvedValueOnce({ ok: true, data: {} }).mockResolvedValueOnce({ ok: true, data: { ok: true } });
    const args = [token, 'Password123', 'Password123'] as const;
    expect((await completeBusinessPasswordReset(...args)).ok).toBe(false);
    expect((await completeBusinessPasswordReset(...args)).ok).toBe(false);
    expect((await completeBusinessPasswordReset(...args)).ok).toBe(true);
  });
  it('does not send invalid requests or pretend a demo password was reset', async () => {
    api.mode = 'demo'; expect((await requestBusinessPasswordReset('admin@example.test')).ok).toBe(false);
    expect((await requestBusinessPasswordReset('not-an-email')).ok).toBe(false);
    expect((await completeBusinessPasswordReset(token, 'short', 'different')).ok).toBe(false);
    expect(api.invoke).not.toHaveBeenCalled();
  });
  it.each(['caresuiteplus:///auth/reset-password', 'caresuiteplus://auth/reset-password', 'https://www.caresuiteplus.app/auth/reset-password', 'https://caresuiteplus.app/liquid-command/access/reset-password'])('accepts a one-time token only on the approved app route %s', url => {
    expect(extractNativeBusinessRecoveryToken(`${url}#token_hash=${token}&type=recovery`)).toBe(token);
  });
  it.each(['https://evil.test/auth/reset-password', 'https://www.caresuiteplus.app.evil.test/auth/reset-password', 'https://user:password@www.caresuiteplus.app/auth/reset-password', 'caresuiteplus://auth:123/reset-password', 'caresuiteplus:///support', 'https://www.caresuiteplus.app:8443/auth/reset-password', 'caresuiteplus:///auth/reset-password?redirect=evil'])('rejects misleading return URLs %s', url => {
    expect(extractNativeBusinessRecoveryToken(`${url}#token_hash=${token}&type=recovery`)).toBeNull();
  });
  it.each([`token_hash=${token}&type=magiclink`, 'access_token=private&refresh_token=private&type=recovery', `token_hash=${token}&type=recovery&access_token=private`, `token_hash=${token}&token_hash=${token}&type=recovery`])('rejects session tokens and ambiguous fragments %s', fragment => {
    expect(extractNativeBusinessRecoveryToken(`caresuiteplus:///auth/reset-password#${fragment}`)).toBeNull();
  });
});
