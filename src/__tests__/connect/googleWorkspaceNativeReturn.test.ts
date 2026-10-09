import { describe, expect, it } from 'vitest';
import { safeGoogleWorkspaceReturnUrl, NATIVE_WORKSPACE_RETURN_URL } from '../../../supabase/functions/_shared/googleWorkspaceReturnUrl';
const fallback = 'https://www.caresuiteplus.app';
const denied = `${fallback}/business/connect/google-workspace`;
const resolve = (raw: string) => safeGoogleWorkspaceReturnUrl(raw, fallback, `${fallback},https://caresuiteplus.app`);
describe('Google OAuth return to the native app', () => {
  it.each(['caresuiteplus:///business/connect/google-workspace', 'caresuiteplus://business/connect/google-workspace'])('returns %s to the native Workspace screen', value => { expect(resolve(value)).toBe(NATIVE_WORKSPACE_RETURN_URL); });
  it.each(['caresuiteplus:///portal/employee', 'caresuiteplus:///business/connect/google-workspace?next=other', 'caresuiteplus:///business/connect/google-workspace#redirect', 'otherapp:///business/connect/google-workspace', 'caresuiteplus://evil.example/business/connect/google-workspace', 'https://evil.example/business/connect/google-workspace', 'https://user:secret@www.caresuiteplus.app/business/connect/google-workspace', 'javascript:alert(1)', 'not a URL'])('rejects an unapproved return URL: %s', value => { expect(resolve(value)).toBe(denied); });
  it('retains approved web return URLs', () => { const value = `${fallback}/business/connect/google-workspace?service=tasks`; expect(resolve(value)).toBe(value); });
});
