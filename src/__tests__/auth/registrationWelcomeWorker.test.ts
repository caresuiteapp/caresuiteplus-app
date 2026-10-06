import { describe, expect, it, vi } from 'vitest';
import {
  authorizeRegistrationWelcomeWorker, createRegistrationWelcomeQueue,
  dispatchRegistrationWelcomeEmails, processRegistrationWelcomeQueue,
  type RegistrationWelcomeItem,
} from '../../../supabase/functions/registration-welcome-dispatch/worker';

const item: RegistrationWelcomeItem = { id:'mail-job',tenant_id:'tenant',tenant_user_id:'owner',auth_user_id:'auth-user',recipient_email:'admin@example.test',lease_token:'lease' };
const details = { companyName:'Company',recipientName:'Admin',recipientEmail:item.recipient_email,username:'admin.company' };
const queued = (target: unknown = details) => ({ claim:vi.fn().mockResolvedValue([item]),target:vi.fn().mockResolvedValue(target),finish:vi.fn().mockResolvedValue(undefined) });

describe('welcome queue worker', () => {
  it('claims only the completed registration tenant and records provider acceptance', async () => {
    const queue=queued();const send=vi.fn().mockResolvedValue({ok:true,providerMessageId:'accepted'});
    expect(await processRegistrationWelcomeQueue(queue,{send},'tenant')).toEqual({accepted:1,retry:0,failed:0,cancelled:0});
    expect(queue.claim).toHaveBeenCalledWith('tenant');
    expect(send).toHaveBeenCalledWith(details,'mail-job');
    expect(queue.finish).toHaveBeenCalledWith(item,'sent','accepted',null);
  });
  it('cancels changed/deleted accounts without sending to an old recipient', async () => {
    const queue=queued(null);const send=vi.fn();
    expect((await processRegistrationWelcomeQueue(queue,{send})).cancelled).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(queue.finish).toHaveBeenCalledWith(item,'cancelled',null,'registration_account_changed');
  });
  it('gives an intentional resend a new provider key while keeping retries of that resend stable', async () => {
    const queue=queued();queue.claim.mockResolvedValue([{...item,delivery_revision:2}]);
    const send=vi.fn().mockResolvedValue({ok:true,providerMessageId:'resent'});
    await processRegistrationWelcomeQueue(queue,{send});
    await processRegistrationWelcomeQueue(queue,{send});
    expect(send.mock.calls.map(call=>call[1])).toEqual(['mail-job/2','mail-job/2']);
  });
  it('leaves missing sender credentials unclaimed rather than exhausting retries', async () => {
    const rpc=vi.fn();
    expect(await dispatchRegistrationWelcomeEmails({rpc} as never,{})).toMatchObject({configured:false});
    expect(rpc).not.toHaveBeenCalled();
  });
  it('stores retryable and permanent outcomes separately', async () => {
    for(const retryable of [true,false]) {
      const queue=queued();const send=vi.fn().mockResolvedValue({ok:false,retryable,code:'mail_http_503'});
      await processRegistrationWelcomeQueue(queue,{send});
      expect(queue.finish).toHaveBeenCalledWith(item,retryable?'retry':'failed',null,'mail_http_503');
    }
  });
  it('preserves leases when a DB lookup or acceptance write is unconfirmed', async () => {
    const queue=queued();queue.target.mockRejectedValue(new Error('db unavailable'));
    const send=vi.fn();
    await expect(processRegistrationWelcomeQueue(queue,{send})).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();expect(queue.finish).not.toHaveBeenCalled();
    const accepted=queued();accepted.finish.mockRejectedValue(new Error('write lost'));
    await expect(processRegistrationWelcomeQueue(accepted,{send:vi.fn().mockResolvedValue({ok:true,providerMessageId:'id'})})).rejects.toThrow();
  });
  it('requires a dedicated random token and checks its hash server side', async () => {
    const rpc=vi.fn().mockResolvedValue({data:true,error:null});
    expect(await authorizeRegistrationWelcomeWorker({rpc},null)).toBe(false);
    expect(await authorizeRegistrationWelcomeWorker({rpc},'Bearer service-role-jwt')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    const token='a'.repeat(64);
    expect(await authorizeRegistrationWelcomeWorker({rpc},`Bearer ${token}`)).toBe(true);
    const args=rpc.mock.calls[0][1];
    expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(args.p_token_hash).not.toBe(token);
    rpc.mockResolvedValueOnce({data:false,error:null});
    expect(await authorizeRegistrationWelcomeWorker({rpc},`Bearer ${token}`)).toBe(false);
  });
  it('validates current identity, owner email and active company before resolving the message', async () => {
    const owner={username:'admin.current',email:item.recipient_email,display_name:'Current Admin',status:'active',role_key:'owner'};
    const tenant={name:'Current Company',status:'active'};
    const getUserById=vi.fn().mockResolvedValue({data:{user:{email:item.recipient_email}},error:null});
    const from=vi.fn((table:string)=>{const q={select:()=>q,eq:vi.fn(()=>q),maybeSingle:async()=>({data:table==='tenants'?tenant:owner,error:null})};return q;});
    const client={rpc:vi.fn(),from,auth:{admin:{getUserById}}};
    const queue=createRegistrationWelcomeQueue(client as never);
    expect(await queue.target(item)).toEqual({companyName:'Current Company',recipientName:'Current Admin',recipientEmail:item.recipient_email,username:'admin.current'});
    getUserById.mockResolvedValueOnce({data:{user:{email:'new@example.test'}},error:null});
    expect(await queue.target(item)).toBeNull();
    owner.email='other@example.test';expect(await queue.target(item)).toBeNull();
    owner.email=item.recipient_email;tenant.status='blocked';expect(await queue.target(item)).toBeNull();
    getUserById.mockResolvedValueOnce({data:{user:null},error:{status:503}});
    await expect(queue.target(item)).rejects.toThrow('identity_lookup_failed');
  });
  it('does not run any transport for an empty queue', async () => {
    const queue=queued();queue.claim.mockResolvedValue([]);const send=vi.fn();
    expect(await processRegistrationWelcomeQueue(queue,{send})).toEqual({accepted:0,retry:0,failed:0,cancelled:0});
    expect(send).not.toHaveBeenCalled();
  });
});
