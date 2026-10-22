import { SIGNATURE_SERVICE, ENCRYPTION_SERVICE, DOCUMENT_OPERATIONS, CMS_XML_LIMIT, documentBody } from './connector-document-xml.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KonnektorError, connectorFail, connectorSignal } from './connector-error.mjs';

export const CERTIFICATE_SERVICE = 'http://ws.gematik.de/conn/CertificateService/v6.0';
export const EVENT_SERVICE = 'http://ws.gematik.de/conn/EventService/v7.2';
export const CARD_SERVICE = 'http://ws.gematik.de/conn/CardService/v8.1';
export const CARD_COMMON = 'http://ws.gematik.de/conn/CardServiceCommon/v2.0';
export const AUTH_SERVICE = 'http://ws.gematik.de/conn/SignatureService/v7.4';
export const DSS = 'urn:oasis:names:tc:dss:1.0:core:schema';
export const ECDSA_TYPE = 'urn:bsi:tr:03111:ecdsa';
export const PIN_OPERATIONS = Object.freeze(['VerifyPin', 'ChangePin', 'UnblockPin']);
export const connectorService = operation => ['GetJobNumber', 'SignDocument'].includes(operation) ? SIGNATURE_SERVICE
  : ['EncryptDocument', 'DecryptDocument'].includes(operation) ? ENCRYPTION_SERVICE
  : operation === 'GetCards' ? EVENT_SERVICE
  : operation === 'ExternalAuthenticate' ? AUTH_SERVICE
  : operation === 'GetPinStatus' || PIN_OPERATIONS.includes(operation) ? CARD_SERVICE
  : ['ReadCardCertificate', 'VerifyCertificate'].includes(operation) ? CERTIFICATE_SERVICE : undefined;
export const CERTIFICATE_COMMON = 'http://ws.gematik.de/conn/CertificateServiceCommon/v2.0';
export const CONNECTOR_COMMON = 'http://ws.gematik.de/conn/ConnectorCommon/v5.0';
export const CONNECTOR_CONTEXT = 'http://ws.gematik.de/conn/ConnectorContext/v2.0';
export const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
export const CERT_REFS = Object.freeze(['C.AUT', 'C.ENC', 'C.SIG', 'C.QES']);
export function connectorText(value, limit = 64) {
  if (typeof value !== 'string' || !value.length || value.length > limit || value !== value.trim()
    || /[\x00-\x1f\x7f\ud800-\udfff\ufffe\uffff]/.test(value)) connectorFail('INPUT');
  return value;
}
const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function certificateRequest(operation, context, input) {
  const namespace = connectorService(operation);
  if (!namespace) connectorFail('INPUT');
  if (operation === 'UnblockPin' && typeof input.setNewPin !== 'boolean') connectorFail('INPUT');
  const ctx = `<ctx:Context>${[['mandantId', 'MandantId'], ['clientSystemId', 'ClientSystemId'], ['workplaceId', 'WorkplaceId'],
    ...(context.userId === undefined ? [] : [['userId', 'UserId']])].map(([key, name]) => `<n:${name}>${escape(connectorText(context[key]))}</n:${name}>`).join('')}</ctx:Context>`;
  const body = DOCUMENT_OPERATIONS.includes(operation) ? documentBody(operation, ctx, input, escape) : operation === 'GetCards' ? `${ctx}${[['ctId', 'CtId'], ['slotId', 'SlotId'], ['cardType', 'CardType']]
    .filter(([key]) => input[key] !== undefined).map(([key, name]) => `<card:${name}>${escape(String(input[key]))}</card:${name}>`).join('')}`
    : operation === 'VerifyCertificate' ? `${ctx}<cc:X509Certificate>${input.certificate.toString('base64')}</cc:X509Certificate>`
    : operation === 'ExternalAuthenticate' ? `<n:CardHandle>${escape(connectorText(input.cardHandle, 128))}</n:CardHandle>${ctx}<c:OptionalInputs><dss:SignatureType>${ECDSA_TYPE}</dss:SignatureType></c:OptionalInputs><c:BinaryString><dss:Base64Data MimeType="application/octet-stream">${input.digest.toString('base64')}</dss:Base64Data></c:BinaryString>`
    : namespace === CARD_SERVICE ? `${ctx}<n:CardHandle>${escape(connectorText(input.cardHandle, 128))}</n:CardHandle><card:PinTyp>PIN.SMC</card:PinTyp>`
      + (operation === 'UnblockPin' ? `<c:SetNewPin>${input.setNewPin}</c:SetNewPin>` : '')
    : `<n:CardHandle>${escape(connectorText(input.cardHandle, 128))}</n:CardHandle>${ctx}<c:CertRefList>${input.certRefs.map(ref => `<c:CertRef>${ref}</c:CertRef>`).join('')}</c:CertRefList><c:Crypt>${input.crypt}</c:Crypt>`;
  const attribute = operation === 'GetCards' ? ` mandant-wide="${input.mandantWide}"` : '';
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="${SOAP}" xmlns:c="${namespace}" xmlns:cc="${CERTIFICATE_COMMON}" xmlns:n="${CONNECTOR_COMMON}" xmlns:ctx="${CONNECTOR_CONTEXT}" xmlns:card="${CARD_COMMON}" xmlns:dss="${DSS}"><s:Body><c:${operation}${attribute}>${body}</c:${operation}></s:Body></s:Envelope>`);
}
export function inspectConnectorXml(bytes, { operation, mode, python = 'python3', signal } = {}) {
  connectorSignal(signal);
  const cms = DOCUMENT_OPERATIONS.includes(operation), limit = cms ? CMS_XML_LIMIT : 262144;
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > limit
    || !connectorService(operation) || !['request', 'response'].includes(mode)) connectorFail('INPUT');
  const input = Buffer.from(JSON.stringify({ operation, mode, xml: Buffer.from(bytes).toString('base64') }));
  return new Promise((resolve, reject) => {
    let child, done = false, size = 0; const chunks = [];
    const finish = (code, value) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
      if (code) child?.kill('SIGKILL'); input.fill(0);
      if (code) reject(new KonnektorError(code)); else resolve(value);
    };
    const aborted = () => finish('KIM_CONNECTOR_ABORTED');
    const timer = setTimeout(() => finish('KIM_CONNECTOR_XML_TIMEOUT'), cms ? 15000 : 5000);
    signal?.addEventListener('abort', aborted, { once: true });
    try {
      child = spawn(python, ['-I', fileURLToPath(new URL('./connector-xml.py', import.meta.url)), ...(cms ? ['--cms'] : [])], {
        shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
      });
      child.on('error', () => finish('KIM_CONNECTOR_XML_UNAVAILABLE'));
      child.stdin.on('error', () => {}); child.stderr.resume();
      child.stdout.on('data', chunk => { size += chunk.length; if (size > (cms ? CMS_XML_LIMIT : 131072)) return finish('KIM_CONNECTOR_XML_LIMIT'); chunks.push(chunk); });
      child.on('close', code => {
        if (done) return;
        if (code !== 0) return finish('KIM_CONNECTOR_XML_REJECTED');
        try {
          const result = JSON.parse(Buffer.concat(chunks));
          if (result.error) return finish(/^KIM_CONNECTOR_[A-Z_]{1,40}$/.test(result.error) ? result.error : 'KIM_CONNECTOR_XML_REJECTED');
          finish(undefined, result);
        } catch { finish('KIM_CONNECTOR_XML_REJECTED'); }
      });
      child.stdin.end(input);
    } catch { finish('KIM_CONNECTOR_XML_UNAVAILABLE'); }
  });
}
