/** Transactional onboarding email. Never accepts or renders passwords/tokens. */
import { REGISTRATION_WELCOME_ASSETS } from './registrationWelcomeAssets.ts';
import { CARESUITE_GMAIL_SENDER, sendGmailSystemEmail, type GmailSmtpCredentials } from './gmailSmtp.ts';

export const REGISTRATION_WELCOME_TEMPLATE = 'registration-welcome-v1';
export const REGISTRATION_APP_URL = 'https://www.caresuiteplus.app';
export const REGISTRATION_SUPPORT_EMAIL = 'caresuiteapp@gmail.com';
export const REGISTRATION_SYSTEM_SENDER = `CareSuite HealthOS System <${CARESUITE_GMAIL_SENDER}>`;

export type RegistrationWelcomeDetails = {
  companyName: string;
  recipientName: string;
  recipientEmail: string;
  username: string;
};
export type RegistrationWelcomeConfig = {
  provider: 'resend' | 'sendgrid' | 'gmail' | null;
  apiKey: string | null;
  smtp: GmailSmtpCredentials | null;
  from: string | null;
  replyTo: string | null;
  supportEmail: string;
  appUrl: string;
};

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function resolveRegistrationWelcomeConfig(env: Record<string, string | undefined>): RegistrationWelcomeConfig {
  // The explicitly selected Gmail account is the default system sender.
  const providerChoice = env.REGISTRATION_EMAIL_PROVIDER?.trim().toLowerCase() || 'gmail';
  if (!['gmail', 'resend', 'sendgrid'].includes(providerChoice)) throw new Error('Invalid system email provider.');
  // The new default overrides an obsolete No-Reply environment value.
  // Other transports remain available only through an explicit provider choice.
  const configuredFrom = providerChoice === 'gmail' ? CARESUITE_GMAIL_SENDER : env.REGISTRATION_EMAIL_FROM?.trim() || null;
  const senderAddress = configuredFrom?.match(/<([^<>]+)>$/)?.[1] ?? configuredFrom;
  const gmailSender = providerChoice === 'gmail';
  const from = senderAddress ? `CareSuite HealthOS System <${senderAddress}>` : null;
  const resend = env.RESEND_API_KEY?.trim();
  const sendgrid = env.SENDGRID_API_KEY?.trim();
  const gmailPassword = env.GMAIL_SMTP_APP_PASSWORD?.replace(/ /g, '').trim() || null;
  if (gmailPassword && !/^[A-Za-z0-9]{16}$/.test(gmailPassword)) {
    throw new Error('Invalid Gmail SMTP app-password configuration.');
  }
  const supportEmail = env.REGISTRATION_SUPPORT_EMAIL?.trim() || REGISTRATION_SUPPORT_EMAIL;
  let appUrl = REGISTRATION_APP_URL;
  if (env.REGISTRATION_APP_URL) {
    const parsed = new URL(env.REGISTRATION_APP_URL);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') {
      throw new Error('REGISTRATION_APP_URL must be an HTTPS origin.');
    }
    appUrl = parsed.origin;
  }
  if (!emailPattern.test(supportEmail) || (senderAddress && (!emailPattern.test(senderAddress) || /[\r\n]/.test(configuredFrom!) || (!gmailSender && !/^no-?reply@/i.test(senderAddress))))) {
    throw new Error('Invalid registration email configuration.');
  }
  return {
    // Gmail cannot be authenticated by a Resend/SendGrid key or the ChatGPT connector.
    provider: gmailSender ? (gmailPassword ? 'gmail' : null) : from && providerChoice === 'resend' && resend ? 'resend' : from && providerChoice === 'sendgrid' && sendgrid ? 'sendgrid' : null,
    apiKey: gmailSender ? null : providerChoice === 'resend' ? resend || null : sendgrid || null,
    smtp: gmailSender && gmailPassword ? { user: CARESUITE_GMAIL_SENDER, password: gmailPassword } : null,
    from,
    replyTo: senderAddress,
    supportEmail,
    appUrl,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function buildRegistrationWelcomeEmail(
  details: RegistrationWelcomeDetails,
  config: Pick<RegistrationWelcomeConfig, 'appUrl' | 'supportEmail'> = { appUrl: REGISTRATION_APP_URL, supportEmail: REGISTRATION_SUPPORT_EMAIL },
  imageMode: 'email' | 'preview' = 'email',
): { subject: string; text: string; html: string } {
  const imageSource = (key: 'logo' | 'neo') => {
    const asset = REGISTRATION_WELCOME_ASSETS.find(item => item.key === key)!;
    return imageMode === 'preview' ? `data:${asset.type};base64,${asset.content}` : `cid:${asset.contentId}`;
  };
  const loginUrl = `${config.appUrl}/auth/business-login`;
  const resetUrl = `${config.appUrl}/auth/forgot-password`;
  const supportUrl = `${config.appUrl}/support`;
  const subject = 'Willkommen bei CareSuite HealthOS – Ihr Zugang ist bereit';
  const text = [
    `Hallo ${details.recipientName},`,
    '',
    'vielen Dank für Ihre Registrierung bei CareSuite HealthOS. Schön, dass Sie dabei sind!',
    `Ihr Unternehmen „${details.companyName}“ wurde erfolgreich registriert. Ihr Administrationskonto ist bereit.`,
    '',
    'IHRE ZUGANGSDATEN',
    `Unternehmen: ${details.companyName}`,
    `Zugang: Verwaltung / Administration`,
    `E-Mail für die Anmeldung: ${details.recipientEmail}`,
    `Benutzername: ${details.username}`,
    'Passwort: das von Ihnen bei der Registrierung festgelegte Passwort.',
    `Zur Anmeldung: ${loginUrl}`,
    `Passwort vergessen? ${resetUrl}`,
    '',
    'HALLO VON NEO',
    '„Ich bin Neo – dein kleiner Assistent in deinem CareSuite HealthOS.“',
    'Für einen entspannten Einstieg finden Sie hier Ihre ersten Schritte und den direkten Weg zum Support.',
    '',
    'IN DREI SCHRITTEN STARTKLAR',
    '1. Anmelden: Öffnen Sie die Verwaltungsanmeldung und melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem gewählten Passwort an.',
    '2. Organisation einrichten: Prüfen Sie Ihr Profil sowie die Unternehmens- und Kontaktdaten. Vervollständigen Sie die Einstellungen für Ihren Betrieb.',
    '3. Gemeinsam arbeiten: Legen Sie Mitarbeitende und Klient:innen an. Vergeben Sie passende Zugänge und Berechtigungen für die jeweiligen Portale.',
    '',
    'AUCH UNTERWEGS',
    'CareSuite HealthOS ist im Web und über die Android-App erreichbar. Wählen Sie jeweils das passende Portal: Verwaltung, Mitarbeitende oder Klient:innen.',
    '',
    'WIR HELFEN IHNEN BEIM START',
    `Hilfe in CareSuite: ${supportUrl}`,
    `Support per E-Mail: ${config.supportEmail}`,
    'Nennen Sie uns bitte Ihren Unternehmensnamen und beschreiben Sie Ihr Anliegen. Ein Screenshot ohne vertrauliche Inhalte hilft uns bei der Klärung.',
    '',
    'IHR ZUGANG BLEIBT PERSÖNLICH',
    'Wir senden und erfragen keine Passwörter per E-Mail. Teilen Sie Ihr Passwort nicht und richten Sie für weitere Personen eigene Zugänge ein.',
    'Bitte senden Sie keine Gesundheitsdaten, Klientenunterlagen oder Zugangsdaten unverschlüsselt per E-Mail an den Support.',
    `Sie haben diese Registrierung nicht veranlasst? Kontaktieren Sie uns unter ${config.supportEmail}.`,
    '',
    'Wir freuen uns auf die Zusammenarbeit.',
    'Ihr CareSuite HealthOS Team',
    '',
    'Dies ist eine automatische Nachricht zu Ihrer Registrierung.',
    'Bitte antworten Sie nicht auf diese E-Mail. Verwenden Sie für Fragen das öffentliche Supportformular.',
    `Support-Ticket ohne Anmeldung: ${supportUrl}`,
    `Datenschutz: ${config.appUrl}/datenschutz`,
    `Nutzungsbedingungen: ${config.appUrl}/nutzungsbedingungen`,
    `Impressum: ${config.appUrl}/impressum`,
  ].join('\n');
  const e = escapeHtml;
  const steps = [
    ['01', 'Anmelden.', 'Öffnen Sie die Verwaltungsanmeldung. Nutzen Sie Ihre E-Mail-Adresse und Ihr selbst gewähltes Passwort.'],
    ['02', 'Organisation einrichten.', 'Prüfen Sie Ihr Profil, Ihre Unternehmensdaten und die Kontaktdaten. Vervollständigen Sie die Einstellungen für Ihren Betrieb.'],
    ['03', 'Gemeinsam arbeiten.', 'Legen Sie Mitarbeitende und Klient:innen an. Vergeben Sie passende Zugänge und Berechtigungen für die jeweiligen Portale.'],
  ];
  const rows = [
    ['Unternehmen', details.companyName],
    ['Ihr Zugang', 'Verwaltung / Administration'],
    ['E-Mail für die Anmeldung', details.recipientEmail],
    ['Benutzername', details.username],
  ];
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${subject}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a{color:#85c8ff}.wrap{width:100%;max-width:640px}.value{overflow-wrap:anywhere;word-break:break-word}@media only screen and (max-width:480px){.outer{padding:12px 8px!important}.pad{padding-left:22px!important;padding-right:22px!important}.hero-title{font-size:37px!important;line-height:42px!important}.card-pad{padding:22px!important}.credential-label,.credential-value{display:block!important;width:100%!important}.credential-label{padding-bottom:3px!important}.credential-value{padding-top:0!important;padding-bottom:13px!important}.footer{padding:22px!important}.button{display:block!important;text-align:center!important}.brand-image{width:254px!important;max-width:100%!important}.neo-image-cell,.neo-copy{display:block!important;width:auto!important}.neo-image-cell{padding:20px 20px 0!important}.neo-image-cell img{margin:auto}.neo-copy{padding:12px 22px 24px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#030812;color:#ecf4ff;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;color:#030812;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">Vielen Dank für Ihre Registrierung. Ihr Administrationszugang, Ihre ersten Schritte und unser Support – alles in einer E-Mail.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#030812"><tr><td class="outer" align="center" style="padding:36px 14px">
<!--[if mso]><table role="presentation" width="640" align="center"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background-color:#091324;border:1px solid #263f62;border-radius:30px;overflow:hidden;box-shadow:0 22px 75px #0065ff26">
<tr><td style="height:5px;font-size:0;line-height:0;background-color:#1685ff;background-image:linear-gradient(90deg,#1168ff,#69d9ff,#5b6dff)">&nbsp;</td></tr>
<tr><td class="pad" style="padding:34px 40px 28px;border-bottom:1px solid #1c2d47"><a href="${e(config.appUrl)}" style="text-decoration:none"><img class="brand-image" src="${imageSource('logo')}" alt="CareSuite HealthOS" width="292" height="37" style="display:block;width:292px;max-width:100%;height:auto;color:#fff;font-size:25px;font-weight:bold"></a><p style="margin:13px 0 0;color:#9bb4d3;font-size:11px;line-height:17px;letter-spacing:2.1px">IHR DIGITALER ARBEITSPLATZ.</p></td></tr>
<tr><td class="pad" style="padding:36px 40px 34px;background-color:#0b1c37;background-image:linear-gradient(135deg,#102951 0%,#09162c 75%)">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding:8px 13px;background-color:#122d4c;border:1px solid #2e547d;border-radius:20px;color:#9adeff;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.2px">✓ &nbsp; REGISTRIERUNG ERFOLGREICH</td></tr></table>
<h1 class="hero-title" style="margin:24px 0 18px;color:#fff;font-size:48px;line-height:53px;letter-spacing:-2px;font-weight:800">Willkommen.<br>Ihr HealthOS<br><span style="color:#72c5ff">ist bereit.</span></h1>
<p style="margin:0 0 12px;color:#e8f2ff;font-size:17px;line-height:26px">Hallo ${e(details.recipientName)},</p>
<p style="margin:0;color:#bacce4;font-size:15px;line-height:25px">vielen Dank für Ihre Registrierung bei <strong style="color:#fff">CareSuite HealthOS</strong>. Schön, dass Sie dabei sind! Ihr Unternehmen <strong style="color:#fff">${e(details.companyName)}</strong> wurde erfolgreich registriert. Ihr Administrationskonto ist bereit.</p>
</td></tr>
<tr><td class="pad" style="padding:27px 40px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b2039;border:1px solid #31587f;border-radius:22px;background-image:linear-gradient(120deg,#123459,#0a192d)"><tr><td class="neo-image-cell" width="128" valign="middle" style="width:128px;padding:18px 0 18px 10px"><img src="${imageSource('neo')}" alt="Neo, Ihr CareSuite HealthOS Assistent, begrüßt Sie." width="128" height="128" style="display:block;width:128px;height:128px;max-width:100%"></td><td class="neo-copy" valign="middle" style="padding:22px 19px 22px 13px"><p style="margin:0 0 8px;color:#88d3ff;font-size:11px;line-height:17px;letter-spacing:1.6px;font-weight:bold">HALLO VON NEO</p><p style="margin:0 0 9px;color:#fff;font-size:17px;line-height:25px;font-weight:bold">„Ich bin Neo – dein kleiner Assistent in deinem CareSuite HealthOS.“</p><p style="margin:0;color:#b2c9e3;font-size:12px;line-height:20px">Für einen entspannten Einstieg finden Sie hier Ihre ersten Schritte und den direkten Weg zum Support.</p></td></tr></table></td></tr>
<tr><td class="pad" style="padding:28px 40px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#102039;border:1px solid #315781;border-radius:22px;box-shadow:0 8px 28px #00000033"><tr><td class="card-pad" style="padding:26px">
<p style="margin:0 0 5px;color:#7fc7ff;font-size:11px;line-height:17px;letter-spacing:1.8px;font-weight:bold">ALLES FÜR IHREN ZUGANG</p><h2 style="margin:0 0 19px;color:#fff;font-size:23px;line-height:30px;letter-spacing:-.5px">Ihr Zugang. Ihr Unternehmen.</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${rows.map(([label,value])=>`<tr><td class="credential-label" width="42%" valign="top" style="width:42%;padding:8px 12px 8px 0;color:#9eb5d1;font-size:12px;line-height:20px">${e(label)}</td><td class="credential-value value" width="58%" valign="top" style="width:58%;padding:8px 0;color:#fff;font-size:14px;line-height:20px;font-weight:bold">${e(value)}</td></tr>`).join('')}</table>
<p style="margin:16px 0 23px;padding:13px 15px;background-color:#091629;border:1px solid #274260;border-radius:12px;color:#c2d3e8;font-size:12px;line-height:20px"><strong style="color:#fff">Ihr Passwort:</strong> Nutzen Sie das Passwort, das Sie bei der Registrierung selbst festgelegt haben.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#126cff" style="border-radius:13px;background-color:#126cff;background-image:linear-gradient(100deg,#1169ff,#2399ff);border:1px solid #67b3ff"><a class="button" href="${e(loginUrl)}" style="display:block;padding:17px 16px;color:#fff;font-size:15px;line-height:21px;font-weight:bold;text-decoration:none">Jetzt bei CareSuite anmelden &nbsp; →</a></td></tr></table>
<p style="margin:15px 0 0;text-align:center;color:#9bb4d3;font-size:12px;line-height:20px">Passwort vergessen? <a href="${e(resetUrl)}" style="color:#86caff;text-decoration:underline">Sicher zurücksetzen</a></p>
</td></tr></table></td></tr>
<tr><td class="pad" style="padding:34px 40px 10px"><p style="margin:0 0 7px;color:#80c9ff;font-size:11px;letter-spacing:1.8px;line-height:17px;font-weight:bold">EIN GUTER START IST EINFACH</p><h2 style="margin:0 0 23px;color:#fff;font-size:27px;line-height:33px;letter-spacing:-.7px">In drei Schritten startklar.</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${steps.map(([number,title,description])=>`<tr><td width="52" valign="top" style="padding:0 14px 24px 0"><table role="presentation" width="38" height="38" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#122b4a" style="width:38px;height:38px;border:1px solid #355b87;border-radius:12px;color:#91d0ff;font-size:12px;font-weight:bold">${number}</td></tr></table></td><td valign="top" style="padding:0 0 24px"><h3 style="margin:0 0 5px;color:#ecf4ff;font-size:16px;line-height:23px">${title}</h3><p style="margin:0;color:#a9bed9;font-size:13px;line-height:22px">${description}</p></td></tr>`).join('')}</table>
</td></tr>
<tr><td class="pad" style="padding:0 40px 27px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b223c;border:1px solid #264b70;border-radius:18px"><tr><td style="padding:20px 23px"><p style="margin:0 0 7px;color:#fff;font-size:16px;line-height:23px;font-weight:bold">Ihr Arbeitsplatz geht mit.</p><p style="margin:0;color:#b3c9e1;font-size:13px;line-height:22px">Im Web und über die Android-App: Wählen Sie das passende Portal für <strong style="color:#e9f4ff">Verwaltung, Mitarbeitende oder Klient:innen.</strong></p></td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 40px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#111e33;border:1px solid #2a4262;border-radius:22px"><tr><td class="card-pad" style="padding:25px"><p style="margin:0 0 7px;color:#86cbff;font-size:11px;line-height:17px;letter-spacing:1.7px;font-weight:bold">PERSÖNLICH FÜR SIE DA</p><h2 style="margin:0 0 10px;color:#fff;font-size:23px;line-height:30px;letter-spacing:-.5px">Wir helfen Ihnen beim Start.</h2><p style="margin:0 0 16px;color:#b5c8df;font-size:13px;line-height:22px">Fragen zur Einrichtung oder zur Anmeldung? Nennen Sie uns Ihren Unternehmensnamen und beschreiben Sie Ihr Anliegen. Ein Screenshot ohne vertrauliche Inhalte hilft bei der Klärung.</p><p class="value" style="margin:0 0 11px;font-size:15px;line-height:23px;font-weight:bold"><a href="mailto:${e(config.supportEmail)}" style="color:#8ccfff;text-decoration:none">${e(config.supportEmail)}</a></p><a href="${e(supportUrl)}" style="color:#b8dfff;font-size:13px;line-height:21px;text-decoration:underline">Support-Ticket ohne Anmeldung erstellen &nbsp; →</a></td></tr></table></td></tr>
<tr><td class="pad" style="padding:0 40px 30px"><p style="margin:0 0 8px;color:#d3e6fc;font-size:12px;line-height:21px;font-weight:bold">Ihr Zugang bleibt persönlich.</p><p style="margin:0 0 10px;color:#99b0cd;font-size:12px;line-height:21px">Wir senden und erfragen keine Passwörter per E-Mail. Teilen Sie Ihr Passwort nicht und richten Sie für weitere Personen eigene Zugänge ein. Bitte senden Sie keine Gesundheitsdaten, Klientenunterlagen oder Zugangsdaten unverschlüsselt per E-Mail an den Support.</p><p style="margin:0;color:#99b0cd;font-size:12px;line-height:21px">Sie haben diese Registrierung nicht veranlasst? <a href="mailto:${e(config.supportEmail)}" style="color:#85c8ff">Kontaktieren Sie uns.</a></p></td></tr>
<tr><td class="footer" style="padding:26px 40px 30px;background-color:#06101f;border-top:1px solid #1c2d47"><p style="margin:0 0 6px;color:#e2efff;font-size:14px;line-height:22px;font-weight:bold">Wir freuen uns auf die Zusammenarbeit.</p><p style="margin:0 0 18px;color:#a3bad6;font-size:13px;line-height:21px">Ihr CareSuite HealthOS Team</p><p style="margin:0 0 10px;color:#7f98b8;font-size:11px;line-height:19px">Dies ist eine automatische Systemnachricht zu Ihrer Registrierung. <strong style="color:#bdcfe6">Bitte antworten Sie nicht auf diese E-Mail.</strong> Verwenden Sie für Fragen das <a href="${e(supportUrl)}" style="color:#9cb8da">öffentliche Supportformular</a>.</p><p style="margin:0;font-size:11px;line-height:22px"><a href="${e(config.appUrl)}/datenschutz" style="color:#9cb8da">Datenschutz</a> &nbsp;·&nbsp; <a href="${e(config.appUrl)}/nutzungsbedingungen" style="color:#9cb8da">Nutzungsbedingungen</a> &nbsp;·&nbsp; <a href="${e(config.appUrl)}/impressum" style="color:#9cb8da">Impressum</a></p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return { subject, text, html };
}

export type WelcomeSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; retryable: boolean; code: string };

export async function sendRegistrationWelcomeEmail(
  config: RegistrationWelcomeConfig,
  details: RegistrationWelcomeDetails,
  deliveryId: string,
  fetcher: typeof fetch = fetch,
): Promise<WelcomeSendResult> {
  return sendCareSuiteSystemEmail(config, details.recipientEmail, buildRegistrationWelcomeEmail(details, config), `${REGISTRATION_WELCOME_TEMPLATE}/${deliveryId}`, fetcher);
}

/** Shared transport: system sender, separate support, and original inline artwork. */
export async function sendCareSuiteSystemEmail(
  config: RegistrationWelcomeConfig,
  recipientEmail: string,
  content: { subject: string; text: string; html: string },
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<WelcomeSendResult> {
  if (config.provider === 'gmail') {
    if (!config.smtp) return { ok: false, retryable: true, code: 'mail_not_configured' };
    return sendGmailSystemEmail(config.smtp, recipientEmail, content, idempotencyKey);
  }
  if (!config.provider || !config.apiKey || !config.from) return { ok: false, retryable: true, code: 'mail_not_configured' };
  const resend = config.provider === 'resend';
  const headers: Record<string,string> = { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
  if (resend) headers['Idempotency-Key'] = idempotencyKey;
  const sender = config.from.match(/^(.*?)\s*<([^<>]+)>$/);
  const automaticHeaders = { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' };
  const payload = resend ? {
    from: config.from, to: [recipientEmail], reply_to: config.replyTo, ...content,
    headers: automaticHeaders,
    attachments: REGISTRATION_WELCOME_ASSETS.map(asset => ({ filename: asset.filename, content: asset.content, content_id: asset.contentId })),
  } : {
    personalizations: [{ to: [{ email: recipientEmail }] }],
    from: { email: sender?.[2] ?? config.from, name: sender?.[1]?.trim() || 'CareSuite HealthOS' },
    reply_to: { email: config.replyTo }, subject: content.subject,
    headers: automaticHeaders,
    attachments: REGISTRATION_WELCOME_ASSETS.map(asset => ({ filename: asset.filename, content: asset.content, type: asset.type, disposition: 'inline', content_id: asset.contentId })),
    content: [{ type: 'text/plain', value: content.text }, { type: 'text/html', value: content.html }],
  };
  try {
    const response = await fetcher(resend ? 'https://api.resend.com/emails' : 'https://api.sendgrid.com/v3/mail/send', {
      method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      // Resend retains the idempotency key for 24 h; the queue retries for <23 h.
      // SendGrid has no equivalent guarantee: ambiguous 5xx responses need review.
      return { ok: false, retryable: response.status === 429 || (resend && response.status >= 500), code: `mail_http_${response.status}` };
    }
    if (resend) {
      const data = await response.json().catch(() => null) as { id?: unknown } | null;
      if (typeof data?.id !== 'string') return { ok: false, retryable: true, code: 'mail_response_unconfirmed' };
      return { ok: true, providerMessageId: data.id };
    }
    return { ok: true, providerMessageId: response.headers.get('x-message-id') };
  } catch {
    return { ok: false, retryable: resend, code: resend ? 'mail_transport_unconfirmed' : 'mail_delivery_needs_review' };
  }
}
