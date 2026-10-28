import { describe, expect, it } from 'vitest';
import { matchesOfflineSecurityReceipt } from '@/lib/auth/accountSecurityReceipt';
const now=Date.parse('2026-10-28T12:00:00Z');
const token=(session_id='session-a',aal='aal2')=>`header.${btoa(JSON.stringify({session_id,aal}))}.signature`;
const receipt=(patch:Record<string,unknown>={})=>JSON.stringify({sessionId:'session-a',active:true,mfaRequired:true,aal:'aal2',validUntil:now+60_000,...patch});
describe('offline security receipt belongs to the original verified session',()=>{
  it('keeps a recent own receipt readable without claiming a fresh server check',()=>{expect(matchesOfflineSecurityReceipt(receipt(),token(),now)?.active).toBe(true);});
  it.each([null,'broken',receipt({active:false}),receipt({validUntil:now}),receipt({validUntil:now+25*3600_000}),receipt({aal:'aal1'})])('rejects missing, damaged, inactive or expired receipts',raw=>{expect(matchesOfflineSecurityReceipt(raw,token(),now)).toBeNull();});
  it('does not reuse MFA from another session or a lower-assurance token after relogin',()=>{
    expect(matchesOfflineSecurityReceipt(receipt(),token('session-b'),now)).toBeNull();expect(matchesOfflineSecurityReceipt(receipt(),token('session-a','aal1'),now)).toBeNull();
  });
});
