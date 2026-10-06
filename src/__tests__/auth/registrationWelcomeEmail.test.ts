import { describe, expect, it, vi } from 'vitest';
import {createHash} from 'node:crypto';
import {
  buildRegistrationWelcomeEmail,
  resolveRegistrationWelcomeConfig,
  sendRegistrationWelcomeEmail,
} from '../../../supabase/functions/_shared/registrationWelcomeEmail';

const details = { companyName: 'Pflege & Alltag GmbH', recipientName: 'Maria Müller', recipientEmail: 'maria@example.test', username: 'admin.company' };
const config = resolveRegistrationWelcomeConfig({ REGISTRATION_EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-key', REGISTRATION_EMAIL_FROM: 'no-reply@example.test' });

describe('registration welcome content and delivery', () => {
  it('includes real branding, Neo, credentials, login, first steps and support in HTML and plain text', () => {
    const content = buildRegistrationWelcomeEmail(details);
    for (const value of [details.recipientName, details.username, details.recipientEmail, 'Neo', 'caresuiteapp@gmail.com', '/auth/business-login', '/auth/forgot-password']) {
      expect(content.html).toContain(value);
      expect(content.text).toContain(value);
    }
    expect(content.html).toContain('src="cid:caresuite-logo"');
    expect(content.html).toContain('src="cid:caresuite-neo"');
    expect(content.html).toContain('Bitte antworten Sie nicht');
    expect(content.text).toContain('Bitte antworten Sie nicht');
    expect(content.text).toContain('Support-Ticket ohne Anmeldung');
    expect(content.text).toContain(details.companyName);
    expect(content.text).toContain('bei der Registrierung festgelegte Passwort');
    expect(content.html).not.toContain('/business/office');
    expect(content.html).not.toMatch(/<script|<iframe|<video/i);
  });
  it('escapes personal/company data and never treats submitted content as HTML', () => {
    const content = buildRegistrationWelcomeEmail({ ...details, companyName: '<img src=x onerror=alert(1)> & "Partner"', recipientName: '<script>boom</script>' });
    expect(content.html).not.toContain('<script>boom');
    expect(content.html).toContain('&lt;script&gt;boom&lt;/script&gt;');
    expect(content.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Partner&quot;');
  });
  it('defaults to the chosen Gmail sender without reusing an unrelated provider credential', () => {
    expect(resolveRegistrationWelcomeConfig({ RESEND_API_KEY: 'key', DOCUMENT_EMAIL_FROM: 'mail@example.test' })).toMatchObject({ provider: null, from: 'CareSuite HealthOS System <caresuiteapp@gmail.com>', smtp: null });
    expect(resolveRegistrationWelcomeConfig({ REGISTRATION_EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'key', REGISTRATION_EMAIL_FROM: 'noreply@example.test' })).toMatchObject({ provider: 'sendgrid',from:'CareSuite HealthOS System <noreply@example.test>' });
    expect(()=>resolveRegistrationWelcomeConfig({REGISTRATION_EMAIL_PROVIDER:'resend',RESEND_API_KEY:'key',REGISTRATION_EMAIL_FROM:'support@example.test'})).toThrow();
    expect(resolveRegistrationWelcomeConfig({ RESEND_API_KEY: 'key' }).provider).toBeNull();
    expect(resolveRegistrationWelcomeConfig({ DOCUMENT_EMAIL_API_URL: 'https://example.test' }).provider).toBeNull();
    expect(() => resolveRegistrationWelcomeConfig({ REGISTRATION_EMAIL_PROVIDER: 'resend', REGISTRATION_EMAIL_FROM: 'mail@example.test\r\nBcc: x@example.test' })).toThrow();
    expect(() => resolveRegistrationWelcomeConfig({ REGISTRATION_APP_URL: 'javascript:alert(1)' })).toThrow();
    expect(() => resolveRegistrationWelcomeConfig({ REGISTRATION_APP_URL: 'https://user:pass@example.test/' })).toThrow();
  });
  it('uses only the explicitly authorized Gmail account with its own app password', () => {
    expect(resolveRegistrationWelcomeConfig({ GMAIL_SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop', RESEND_API_KEY: 'unrelated' })).toMatchObject({
      provider: 'gmail', apiKey: null, from: 'CareSuite HealthOS System <caresuiteapp@gmail.com>',
      smtp: { user: 'caresuiteapp@gmail.com', password: 'abcdefghijklmnop' },
    });
    expect(resolveRegistrationWelcomeConfig({ REGISTRATION_EMAIL_FROM: 'no-reply@caresuiteplus.app', GMAIL_SMTP_APP_PASSWORD: 'abcdefghijklmnop' })).toMatchObject({ provider: 'gmail', from: 'CareSuite HealthOS System <caresuiteapp@gmail.com>' });
    expect(() => resolveRegistrationWelcomeConfig({ GMAIL_SMTP_APP_PASSWORD: 'ordinary-account-password' })).toThrow();
  });
  it('sends both formats to the registered administrator and reuses one idempotency key on retry', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 'provider-1' }), { status: 200 }));
    await expect(sendRegistrationWelcomeEmail(config, details, 'job-1', fetcher)).resolves.toEqual({ ok: true, providerMessageId: 'provider-1' });
    await sendRegistrationWelcomeEmail(config, details, 'job-1', fetcher);
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.to).toEqual(['maria@example.test']);
    expect(payload.from).toBe('CareSuite HealthOS System <no-reply@example.test>');
    expect(payload.reply_to).toBe('no-reply@example.test');
    expect(payload.headers['Auto-Submitted']).toBe('auto-generated');
    expect(payload.attachments.map((asset:any)=>asset.content_id)).toEqual(['caresuite-logo','caresuite-neo']);
    for(const asset of payload.attachments) {
      expect(payload.html).toContain(`src="cid:${asset.content_id}"`);
      expect(Buffer.from(asset.content,'base64').subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
    }
    expect(payload.html).toContain('Neo');
    expect(payload.text).toContain('Maria Müller');
    expect(payload).not.toHaveProperty('adminPassword');
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toEqual(fetcher.mock.calls[1][1].headers['Idempotency-Key']);
  });
  it('distinguishes transient provider responses from permanent failures without leaking error bodies', async () => {
    for (const [status,retryable] of [[429,true],[503,true],[401,false],[422,false]] as const) {
      const fetcher = vi.fn().mockResolvedValue(new Response('secret-token recipient@example.test', { status }));
      expect(await sendRegistrationWelcomeEmail(config, details, 'job', fetcher)).toEqual({ ok: false, retryable, code: `mail_http_${status}` });
    }
    const network = vi.fn().mockRejectedValue(new Error('secret-token recipient@example.test'));
    expect(await sendRegistrationWelcomeEmail(config,details,'job',network)).toEqual({ ok:false,retryable:true,code:'mail_transport_unconfirmed' });
    const sendgrid = resolveRegistrationWelcomeConfig({ REGISTRATION_EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'key', REGISTRATION_EMAIL_FROM: 'no-reply@example.test' });
    expect(await sendRegistrationWelcomeEmail(sendgrid,details,'job',network)).toEqual({ ok:false,retryable:false,code:'mail_delivery_needs_review' });
    const accepted = vi.fn().mockResolvedValue(new Response(null,{status:202,headers:{'x-message-id':'sg-1'}}));
    expect(await sendRegistrationWelcomeEmail(sendgrid,details,'job',accepted)).toEqual({ok:true,providerMessageId:'sg-1'});
    const payload=JSON.parse(accepted.mock.calls[0][1].body);
    expect(payload.from).toEqual({email:'no-reply@example.test',name:'CareSuite HealthOS System'});
    expect(payload.reply_to).toEqual({email:'no-reply@example.test'});
    expect(payload.attachments.every((asset:any)=>asset.type==='image/png'&&asset.disposition==='inline'&&payload.content[1].value.includes(`cid:${asset.content_id}`))).toBe(true);
  });
  it('does not call the transport at all without sender configuration', async () => {
    const fetcher = vi.fn();
    expect(await sendRegistrationWelcomeEmail(resolveRegistrationWelcomeConfig({}),details,'job',fetcher)).toMatchObject({ok:false,code:'mail_not_configured'});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('embeds byte-for-byte original artwork in a standalone preview, without external image requests',()=>{
    const content=buildRegistrationWelcomeEmail(details,undefined,'preview');
    const images=[...content.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match=>match[1]);
    expect(images).toHaveLength(2);
    const expected=['4651b339f3e0b852614f9d17bda6bd97e7721fbdca4125be28ec8c9ff45ee557','303d35fb98fcd341150e0ddc10105d31d3570211018b5913bda6fe1c0dea9b42'];
    images.forEach((source,index)=>{
      expect(source).toMatch(/^data:image\/png;base64,/);
      expect(createHash('sha256').update(Buffer.from(source.split(',')[1],'base64')).digest('hex')).toBe(expected[index]);
    });
  });
});
