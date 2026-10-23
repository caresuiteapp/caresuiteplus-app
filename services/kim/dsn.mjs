import { randomUUID } from 'node:crypto';
import { kimAddress, hostName, messageId } from './address.mjs';

// RFC 3461 xtext. Reject controls: values will eventually occur in DSN headers.
export function decodeXtext(value, limit = 100) {
  if (typeof value !== 'string' || !value || value.length > limit * 3 || /[^\x21-\x7e]|=|\+(?![0-9A-F]{2})/.test(value)) throw new Error('SMTP_XTEXT');
  const decoded = value.replace(/\+([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  if (decoded.length > limit || /[^\x20-\x7e]/.test(decoded)) throw new Error('SMTP_XTEXT');
  return decoded;
}
export const encodeXtext = value => value.replace(/[+=\x20]/g, c => `+${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Only locally generated notifications. No original body or AUT token is included.
 * The sole body exception is an explicitly decoded fdgerr_6 text/plain notification.
 * Local delivery has a null reverse path; this module never emits network mail.
 */
export function buildDsn({ serverName, sender, originalId, envelopeId, arrival, results, errorCode, notificationText }) {
  kimAddress(sender);
  if (!hostName(serverName) || !messageId(originalId) || !Number.isSafeInteger(arrival) || !Array.isArray(results) || !results.length || results.length > 100
    || (errorCode !== undefined && !/^fdgerr_[1-6]$/.test(errorCode))
    || (envelopeId !== undefined && (typeof envelopeId !== 'string' || !envelopeId.length || envelopeId.length > 100 || /[^\x20-\x7e]/.test(envelopeId)))) throw new Error('KIM_DSN_INPUT');
  if (notificationText !== undefined && (errorCode !== 'fdgerr_6' || typeof notificationText !== 'string' || Buffer.byteLength(notificationText) > 65_536 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notificationText))) throw new Error('KIM_DSN_TEXT');
  const id = `<${randomUUID()}@${serverName}>`, boundary = `=_cs_dsn_${randomUUID()}`, date = new Date(arrival).toUTCString();
  const blocks = results.map(r => {
    const address = kimAddress(r.address);
    if (!['delivered', 'failed'].includes(r.action) || !/^[25]\.\d{1,3}\.\d{1,3}$/.test(r.status) || (r.action === 'delivered') !== r.status.startsWith('2.')) throw new Error('KIM_DSN_STATUS');
    return [r.originalRecipient ? `Original-Recipient: rfc822;${kimAddress(r.originalRecipient)}` : undefined,
      `Final-Recipient: rfc822;${address}`, `Action: ${r.action}`, `Status: ${r.status}`].filter(Boolean).join('\r\n');
  });
  const text = 'CareSuite local delivery status.\r\n' + (notificationText === undefined ? 'See the delivery-status part.\r\n' : notificationText.replace(/\r?\n/g, '\r\n') + '\r\n');
  // Quoted-printable is unnecessary for our fixed ASCII text. The exception uses base64 UTF-8.
  const content = notificationText === undefined ? text : Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n';
  const lines = [
    'Return-Path: <>', `From: Mail Delivery System <postmaster@${serverName}>`, `To: <${sender}>`,
    `Date: ${date}`, `Message-ID: ${id}`, `In-Reply-To: ${originalId}`, 'Subject: Delivery Status Notification',
    'Auto-Submitted: auto-generated', ...(errorCode ? [`X-KIM-Fehlermeldung: ${errorCode}`] : []),
    'MIME-Version: 1.0', `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', `Content-Transfer-Encoding: ${notificationText === undefined ? '7bit' : 'base64'}`, '', content,
    `--${boundary}`, 'Content-Type: message/delivery-status', 'Content-Transfer-Encoding: 7bit', '',
    `Reporting-MTA: dns; ${serverName}`, ...(envelopeId === undefined ? [] : [`Original-Envelope-Id: ${encodeXtext(envelopeId)}`]),
    `Arrival-Date: ${date}`, '', blocks.join('\r\n\r\n'), '', `--${boundary}--`, '',
  ];
  return { id, bytes: Buffer.from(lines.join('\r\n')), reversePath: null };
}
