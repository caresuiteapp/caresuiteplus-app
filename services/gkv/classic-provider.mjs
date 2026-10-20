import { verifyPreparedDelivery } from '../../api/_lib/gkv-transport.ts';
import { mailbox, sendSmtp } from './smtp.mjs';

export function buildClassicMessage(delivery, { from, to, messageId, date }) {
  verifyPreparedDelivery(delivery);
  const [data, order] = delivery.files;
  if (delivery.channel !== 'classic' || !/^[ET]PFL\d{4}$/.test(data.name) || order.name !== `${data.name}.AUF` || order.bytes.length !== 348) throw new Error('CLASSIC_FILES');
  if (!mailbox(from) || !mailbox(to) || !/^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/.test(messageId) || messageId.length > 250 || !Number.isFinite(date.getTime())) throw new Error('CLASSIC_HEADERS');
  const boundary = `cs_${delivery.manifestSha256}`;
  const lines = [`From: ${from}`, `To: ${to}`, `Date: ${date.toUTCString()}`, `Message-ID: ${messageId}`,
    `Subject: ${delivery.senderIk}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=US-ASCII', 'Content-Transfer-Encoding: 7bit', '', '',
  ];
  for (const file of [order, data]) lines.push(`--${boundary}`, `Content-Type: application/octet-stream; name="${file.name}"`,
    'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${file.name}"`, '',
    Buffer.from(file.bytes).toString('base64').match(/.{1,76}/g).join('\r\n'));
  lines.push(`--${boundary}--`, '');
  return { from, to, messageId, mime: Buffer.from(lines.join('\r\n')) };
}

/** Fixed server configuration bound to a checked KOTR receiver, never a browser-selected address. */
export function classicSmtpProvider({ senderIk, receiverIk, from, to, smtp }) {
  if (!mailbox(from) || !mailbox(to) || !/^[1-9]\d{8}$/.test(senderIk) || !/^[1-9]\d{8}$/.test(receiverIk)) throw new Error('CLASSIC_ROUTE');
  return { async send(delivery, { idempotencyKey }) {
    if (delivery.senderIk !== senderIk || delivery.receiverIk !== receiverIk || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) throw new Error('CLASSIC_ROUTE_BINDING');
    const message = buildClassicMessage(delivery, { from, to, messageId: `<${idempotencyKey}@${from.split('@')[1]}>`, date: new Date() });
    return sendSmtp(message, smtp);
  }};
}
