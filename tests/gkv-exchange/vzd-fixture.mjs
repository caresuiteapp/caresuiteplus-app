// Ephemeral local LDAP peer with the existing isolated PKI. No TI connection.
import tls from 'node:tls';
import { once } from 'node:events';
import { createHash, X509Certificate } from 'node:crypto';
import { der, fields } from '../../services/gkv/der.mjs';
import { tlv, sequence, octets } from '../../services/kim/cms-codec.mjs';
import { VzdLdapsDirectory } from '../../services/kim/vzd.mjs';

export const bindReply = Buffer.from('300c02010161070a010004000400', 'hex');
export const searchDone = (code = 0) => Buffer.from([0x30, 12, 2, 1, 2, 0x65, 7, 10, 1, code, 4, 0, 4, 0]);
export const entryReply = attributes => sequence(tlv(2, Buffer.from([2])), tlv(0x64, Buffer.concat([
  octets(Buffer.from('uid=local,dc=data,dc=vzd')), sequence(...attributes.map(([name, values]) => sequence(
    octets(Buffer.from(name)), tlv(49, Buffer.concat(values.map(v => octets(typeof v === 'string' ? Buffer.from(v) : v))))))),
])));
export const record = (address, certs, changes = {}) => [
  ['telematikID', [changes.telematikId ?? '10-LOCAL-TEST']],
  ...(!changes.hideMail ? [['mail', [address]]] : []),
  ['kimData', [address + ',1.5']],
  ['userCertificate;binary', certs.map(c => new X509Certificate(c).raw)],
];

export async function vzdFixture(pki, handler, changes = {}) {
  const sockets = new Set(), requests = [], errors = [];
  const server = tls.createServer(pki.tls, socket => {
    sockets.add(socket); let pending = Buffer.alloc(0);
    socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > 8192) return socket.destroy();
      while (pending.length >= 2) {
        let at = 2, length = pending[1];
        if (length & 128) {
          const count = length & 127; if (!count || count > 4) return socket.destroy();
          if (pending.length < 2 + count) return;
          length = 0; for (let i = 0; i < count; i++) length = length * 256 + pending[at++];
        }
        if (pending.length < at + length) return;
        const bytes = Buffer.from(pending.subarray(0, at + length)); pending = pending.subarray(at + length);
        try {
          const [id, op] = fields(der(bytes), 48, 2); requests.push({ id: id.value[0], op: op.tag, bytes });
          if (op.tag === 0x60) { socket.write(changes.bind ?? bindReply); continue; }
          const s = fields(op, 0x63, 8), alternatives = fields(s[6], 0xa1, 2);
          const equality = fields(alternatives[0], 0xa3, 2), address = equality[1].value.toString('utf8');
          Promise.resolve(handler({ socket, address, request: s, bytes })).catch(e => { errors.push(e); socket.destroy(); });
        } catch (e) { errors.push(e); socket.destroy(); }
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const options = { url: `ldaps://localhost.test:${server.address().port}`, connectAddress: '127.0.0.1', ca: pki.roots,
    serverSha256: createHash('sha256').update(new X509Certificate(pki.tls.cert).raw).digest('hex'), environment: 'test' };
  return { options, requests, directory: new VzdLdapsDirectory({ ...options, ...changes.client }),
    async close() { for (const s of sockets) s.destroy(); await new Promise(r => server.close(r)); if (errors.length) throw errors[0]; } };
}
