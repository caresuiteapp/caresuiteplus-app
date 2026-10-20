import { REGISTRATION_WELCOME_ASSETS } from './registrationWelcomeAssets.ts';
import { type RegistrationWelcomeConfig } from './registrationWelcomeEmail.ts';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function buildBusinessRecoveryEmail(
  recipientName: string,
  resetUrl: string,
  config: Pick<RegistrationWelcomeConfig, 'appUrl'>,
  imageMode: 'email' | 'preview' = 'email',
) {
  const e = escapeHtml;
  const image = (key: 'logo' | 'neo') => {
    const asset = REGISTRATION_WELCOME_ASSETS.find(item => item.key === key)!;
    return imageMode === 'preview' ? `data:${asset.type};base64,${asset.content}` : `cid:${asset.contentId}`;
  };
  const supportUrl = `${config.appUrl}/support`;
  const subject = 'CareSuite HealthOS – Passwort für die Verwaltung zurücksetzen';
  return {
    subject,
    text: `Hallo ${recipientName},\n\nfür Ihren Verwaltungszugang wurde eine Passwort-Wiederherstellung angefordert.\n\nNeues Passwort festlegen: ${resetUrl}\n\nDer Link ist nur einmal und zeitlich begrenzt nutzbar. Er gilt ausschließlich für Ihr Verwaltungskonto.\n\nFalls Sie diese Anfrage nicht gestellt haben, können Sie diese Nachricht ignorieren. Ihr Passwort bleibt unverändert. Geben Sie den Link nicht weiter.\n\nBitte antworten Sie nicht auf diese automatische Systemmail. Hilfe und Support-Tickets ohne Anmeldung: ${supportUrl}\n\nIhr CareSuite HealthOS Team`,
    html: `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title><style>img{border:0}table{border-collapse:separate}@media(max-width:480px){.pad{padding:24px!important}.heading{font-size:30px!important;line-height:37px!important}}</style></head><body style="margin:0;background:#030812;color:#ecf4ff;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#091324;border:1px solid #315781;border-radius:26px;overflow:hidden"><tr><td class="pad" style="padding:32px 36px;border-bottom:1px solid #263f62"><img src="${image('logo')}" alt="CareSuite HealthOS" width="270" style="display:block;width:270px;max-width:100%;height:auto"></td></tr><tr><td class="pad" style="padding:34px 36px"><p style="color:#86cbff;font-size:11px;letter-spacing:1.5px;font-weight:bold">SICHERER VERWALTUNGSZUGANG</p><h1 class="heading" style="color:#fff;font-size:38px;line-height:44px;margin:15px 0 24px">Ein neues Passwort.<br>Ihr Zugang bleibt Ihrer.</h1><p style="font-size:15px;line-height:25px;color:#bacce4">Hallo ${e(recipientName)},<br>für Ihren Verwaltungszugang wurde eine Passwort-Wiederherstellung angefordert. Legen Sie über den folgenden Link ein neues Passwort fest.</p><table role="presentation" width="100%"><tr><td align="center" style="background:#126cff;border:1px solid #67b3ff;border-radius:13px"><a href="${e(resetUrl)}" style="display:block;padding:17px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none">Neues Verwaltungspasswort festlegen →</a></td></tr></table><p style="font-size:12px;line-height:21px;color:#a9bed9">Der Link ist nur einmal und zeitlich begrenzt nutzbar. Er gilt ausschließlich für Ihr Verwaltungskonto. Geben Sie den Link nicht weiter.</p><table role="presentation" width="100%" style="background:#102039;border:1px solid #315781;border-radius:18px;margin-top:24px"><tr><td width="92" style="padding:14px 0 14px 10px"><img src="${image('neo')}" alt="Neo" width="82" height="82" style="display:block;width:82px;height:82px"></td><td style="padding:16px 16px 16px 8px;font-size:13px;line-height:22px;color:#b5c8df"><strong style="color:#fff">Neo begleitet Sie zurück.</strong><br>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese Nachricht ignorieren. Ihr Passwort bleibt unverändert.</td></tr></table></td></tr><tr><td class="pad" style="padding:25px 36px;background:#06101f;border-top:1px solid #263f62"><p style="font-size:12px;line-height:21px;color:#a3bad6">Bitte antworten Sie nicht auf diese automatische Systemmail. Für Hilfe nutzen Sie das <a href="${e(supportUrl)}" style="color:#86cbff">öffentliche Supportformular ohne Anmeldung</a>.</p><p style="font-size:13px;line-height:21px;color:#e2efff">Ihr CareSuite HealthOS Team</p><a href="${e(config.appUrl)}/datenschutz" style="font-size:11px;color:#9cb8da">Datenschutz</a> · <a href="${e(config.appUrl)}/impressum" style="font-size:11px;color:#9cb8da">Impressum</a></td></tr></table></td></tr></table></body></html>`,
  };
}
