// Local HTTPS/mTLS peer, deliberately not a Konnektor or TI trust authority.
import https from 'node:https';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { X509Certificate, createHash } from 'node:crypto';
import { KonnektorCertificateClient } from '../../services/kim/connector-certificates.mjs';

export const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
export const CERT = 'http://ws.gematik.de/conn/CertificateService/v6.0';
export const COMMON = 'http://ws.gematik.de/conn/CertificateServiceCommon/v2.0';
export const CONN = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0';
export const ERROR = 'http://ws.gematik.de/tel/error/v2.0';
export const role = '1.2.276.0.76.4.245';
export const hash = b => createHash('sha256').update(b).digest('hex');
export const raw = c => new X509Certificate(c).raw;
export const envelope = body => `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="${SOAP}" xmlns:c="${CERT}" xmlns:cc="${COMMON}" xmlns:n="${CONN}" xmlns:e="${ERROR}"><s:Body>${body}</s:Body></s:Envelope>`;
export const remoteError = (code = 4149) => `<e:Error><e:MessageID>PRIVATE MESSAGE ID</e:MessageID><e:Timestamp>2026-10-22T00:00:00Z</e:Timestamp><e:Trace><e:EventID>PRIVATE EVENT</e:EventID><e:Instance>PRIVATE INSTANCE</e:Instance><e:LogReference>PRIVATE LOG</e:LogReference><e:CompType>LOCAL</e:CompType><e:Code>${code}</e:Code><e:Severity>Error</e:Severity><e:ErrorType>Technical</e:ErrorType><e:ErrorText>PRIVATE ERROR TEXT</e:ErrorText><e:Detail>PRIVATE SECRET</e:Detail></e:Trace></e:Error>`;
export function verificationResponse(result = 'VALID', roles = [role], execution = 'OK') {
  return envelope(`<c:VerifyCertificateResponse><n:Status><n:Result>${execution}</n:Result></n:Status><c:VerificationStatus><c:VerificationResult>${result}</c:VerificationResult>${result === 'VALID' ? '' : remoteError(4151)}</c:VerificationStatus><c:RoleList>${roles.map(r => `<c:Role>${r}</c:Role>`).join('')}</c:RoleList></c:VerifyCertificateResponse>`);
}
export const faultResponse = () => envelope(`<s:Fault><faultcode>s:Server</faultcode><faultstring>PRIVATE FAULT</faultstring><detail>${remoteError()}</detail></s:Fault>`);
export function certificatesResponse(entries) {
  return envelope(`<c:ReadCardCertificateResponse><n:Status><n:Result>OK</n:Result></n:Status><cc:X509DataInfoList>${entries.map(([ref, cert]) => `<cc:X509DataInfo><cc:CertRef>${ref}</cc:CertRef>${cert ? `<cc:X509Data><cc:X509IssuerSerial><cc:X509IssuerName>UNTRUSTED DISPLAY ISSUER</cc:X509IssuerName><cc:X509SerialNumber>999</cc:X509SerialNumber></cc:X509IssuerSerial><cc:X509SubjectName>UNTRUSTED DISPLAY SUBJECT</cc:X509SubjectName><cc:X509Certificate>${raw(cert).toString('base64')}</cc:X509Certificate></cc:X509Data>` : ''}</cc:X509DataInfo>`).join('')}</cc:X509DataInfoList></c:ReadCardCertificateResponse>`);
}
export async function connectorFixture(pki, handler, changes = {}) {
  const requests = [], clients = [], sockets = new Set(), errors = [];
  const server = https.createServer({ ...pki.tls, ca: pki.roots, requestCert: true, rejectUnauthorized: true }, (request, response) => {
    const chunks = []; request.on('data', b => chunks.push(b));
    request.on('end', () => {
      const bytes = Buffer.concat(chunks), item = { bytes, headers: request.headers, url: request.url,
        authorized: request.socket.authorized, clientSha256: hash(request.socket.getPeerCertificate().raw) };
      requests.push(item);
      response.on('error', () => {});
      Promise.resolve().then(() => {
        if (handler) return handler({ request, response, bytes, item, requests });
        response.writeHead(200, { 'Content-Type': 'text/xml; charset=UTF-8' }); response.end(verificationResponse());
      }).catch(e => { errors.push(e); response.destroy(); });
    });
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const options = { url: `https://localhost.test:${server.address().port}/CertificateService`, ca: pki.roots,
    serverSha256: hash(raw(pki.tls.cert)), clientCertificate: pki.sender.certificate,
    clientKey: await readFile(pki.sender.privateKeyPath), clientPassphrase: pki.password.toString(), connectAddress: '127.0.0.1',
    environment: 'test', context: { mandantId: 'tenant-1', clientSystemId: 'CareSuite', workplaceId: 'office-1' }, ...changes };
  const open = (config = {}) => { const client = new KonnektorCertificateClient({ ...options, ...config }); clients.push(client); return client; };
  return { requests, options, open, async close() {
    for (const c of clients) c.close(); for (const socket of sockets) socket.destroy();
    await new Promise(r => server.close(r)); if (errors.length) throw errors[0];
  } };
}
