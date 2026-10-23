import { createHash, createCipheriv, createDecipheriv, randomBytes, sign, verify, X509Certificate } from 'node:crypto';
import { certificateParts, der } from '../../services/gkv/der.mjs';
import { OID, tlv, sequence as seq, sortedSet as set, objectId as id, octets, attribute } from '../../services/kim/cms-codec.mjs';
import { encryptEciesKey, decryptEciesKey } from '../../services/kim/ecies.mjs';
import { readKimEnvelope } from '../../services/kim/envelope.mjs';
import { SIGNATURE_SERVICE, ENCRYPTION_SERVICE, CMS_TYPE } from '../../services/kim/connector-document-xml.mjs';
import { envelope } from './connector-fixture.mjs';
const hash = b => createHash('sha256').update(b).digest();
const integer = n => tlv(2, Buffer.from([n]));
const sha = () => seq(id(OID.sha256));
const rid = c => { const p = certificateParts(c.raw); return seq(p.issuer, p.serial); };
/** Software fixture only; independently checks ECDSA with Node crypto. */
export function cmsVerificationReply(bytes, { now = Date.now(), high = 'VALID', minor = 'valid:signature:OnAllDocuments', signature, certificate, timestampType = 'SYSTEM_TIMESTAMP' } = {}) {
  const content = Buffer.from(bytes.toString().match(/<dss:Base64Signature[^>]*>([^<]+)</)[1], 'base64');
  const signed = der(content).children()[1].children()[0].children(), info = signed[4].children()[0].children();
  const cert = new X509Certificate(signed[3].children()[0].raw);
  if (!verify('sha256', tlv(49, info[3].value), cert.publicKey, info[5].value)) high = 'INVALID';
  const t = new Date(now).toISOString(), d = 'urn:oasis:names:tc:dss:1.0:', valid = `<vr:ResultMajor>${d}detail:valid</vr:ResultMajor>`;
  const ident = '<ds:X509IssuerName>CN=LOCAL SOFTWARE TEST</ds:X509IssuerName><ds:X509SerialNumber>1</ds:X509SerialNumber>';
  const math = `<vr:SigMathOK>${valid}</vr:SigMathOK>`;
  return envelope(`<c:VerifyDocumentResponse xmlns:c="${SIGNATURE_SERVICE}" xmlns:dss="urn:oasis:names:tc:dss:1.0:core:schema" xmlns:vr="urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:schema#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <n:Status><n:Result>OK</n:Result></n:Status><c:VerificationResult><c:HighLevelResult>${high}</c:HighLevelResult><c:TimestampType>${timestampType}</c:TimestampType><c:Timestamp>${t}</c:Timestamp></c:VerificationResult>
    <c:OptionalOutputs><vr:VerificationReport><dss:VerificationTimeInfo><dss:VerificationTime>${t}</dss:VerificationTime></dss:VerificationTimeInfo><vr:IndividualReport>
      <vr:SignedObjectIdentifier><ds:SignatureValue>${(signature ?? info[5].value).toString('base64')}</ds:SignatureValue></vr:SignedObjectIdentifier>
      <dss:Result><dss:ResultMajor>${d}resultmajor:Success</dss:ResultMajor><dss:ResultMinor>${d}resultminor:${minor}</dss:ResultMinor></dss:Result>
      <vr:Details><dss:VerificationTimeInfo><dss:VerificationTime>${t}</dss:VerificationTime></dss:VerificationTimeInfo><vr:DetailedSignatureReport>
        <vr:FormatOK>${valid}</vr:FormatOK><vr:SignatureOK>${math}</vr:SignatureOK><vr:CertificatePathValidity>
          <vr:PathValiditySummary>${valid}</vr:PathValiditySummary><vr:CertificateIdentifier>${ident}</vr:CertificateIdentifier><vr:PathValidityDetail><vr:CertificateValidity>
            <vr:CertificateIdentifier>${ident}</vr:CertificateIdentifier><vr:Subject>PRIVATE SUBJECT</vr:Subject><vr:ChainingOK>${valid}</vr:ChainingOK><vr:ValidityPeriodOK>${valid}</vr:ValidityPeriodOK><vr:ExtensionsOK>${valid}</vr:ExtensionsOK>
            <vr:CertificateValue>${(certificate ?? cert.raw).toString('base64')}</vr:CertificateValue><vr:SignatureOK>${math}</vr:SignatureOK><vr:CertificateStatus><vr:CertStatusOK>${valid}</vr:CertStatusOK></vr:CertificateStatus>
          </vr:CertificateValidity><vr:TrustAnchor><vr:ResultMajor>urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:trustanchor:certDataBase</vr:ResultMajor></vr:TrustAnchor></vr:PathValidityDetail>
        </vr:CertificatePathValidity></vr:DetailedSignatureReport></vr:Details>
    </vr:IndividualReport></vr:VerificationReport></c:OptionalOutputs></c:VerifyDocumentResponse>`);
}
export const cmsUrls = options => ({ signatureServiceUrl: options.url.replace('/CertificateService', '/SignatureService'), encryptionServiceUrl: options.url.replace('/CertificateService', '/EncryptionService') });
export const cmsOperation = bytes => ['GetJobNumber', 'SignDocument', 'EncryptDocument', 'DecryptDocument', 'VerifyDocument'].find(op => bytes.includes(`<c:${op}>`));
export const cmsResponse = (op, data, requestId = 'test') => envelope(op === 'GetJobNumber'
  ? `<c:GetJobNumberResponse xmlns:c="${SIGNATURE_SERVICE}"><c:JobNumber>ABC-123</c:JobNumber></c:GetJobNumberResponse>`
  : op === 'SignDocument' ? `<c:SignDocumentResponse xmlns:c="${SIGNATURE_SERVICE}" xmlns:dss="urn:oasis:names:tc:dss:1.0:core:schema"><c:SignResponse RequestID="${requestId}"><n:Status><n:Result>OK</n:Result></n:Status><dss:SignatureObject><dss:Base64Signature Type="${CMS_TYPE}">${data.toString('base64')}</dss:Base64Signature></dss:SignatureObject></c:SignResponse></c:SignDocumentResponse>`
  : `<c:${op}Response xmlns:c="${ENCRYPTION_SERVICE}" xmlns:dss="urn:oasis:names:tc:dss:1.0:core:schema"><n:Status><n:Result>OK</n:Result></n:Status><n:Document><dss:Base64Data MimeType="${op === 'EncryptDocument' ? 'application/pkcs7-mime' : 'application/octet-stream'}">${data.toString('base64')}</dss:Base64Data></n:Document></c:${op}Response>`);
/** Existing local mTLS peer, software fixture keys ONLY. Does not emulate TI trust. */
export function makeCmsReply({ signingCertificate, signingKey, encryptionKey, now = Date.now, transform = b => b }) {
  const c = new X509Certificate(signingCertificate);
  return bytes => {
    const op = cmsOperation(bytes); if (!op) return null;
    if (op === 'GetJobNumber') return cmsResponse(op);
    if (op === 'VerifyDocument') return cmsVerificationReply(bytes, { now: now() });
    const xml = bytes.toString(), data = Buffer.from(xml.match(/<dss:Base64Data[^>]*>([^<]+)</)[1], 'base64');
    const emails = op === 'DecryptDocument' ? null : Buffer.from(xml.match(/<CMSAttribute>([^<]+)</)[1], 'base64');
    let result;
    if (op === 'SignDocument') {
      const t = new Date(now()).toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z';
      const attrs = set(attribute(OID.contentType, id(OID.data)), attribute(OID.messageDigest, octets(hash(data))),
        attribute(OID.signingTime, tlv(23, Buffer.from(t))), attribute(OID.signingCertificateV2, seq(seq(seq(octets(hash(c.raw)))))), emails);
      const info = seq(integer(1), rid(c), sha(), tlv(160, der(attrs).value), seq(id(OID.ecdsaSha256)), octets(sign('sha256', attrs, signingKey)));
      result = seq(id(OID.signed), tlv(160, seq(integer(1), set(sha()), seq(id(OID.data), tlv(160, octets(data))), tlv(160, c.raw), set(info))));
    } else if (op === 'EncryptDocument') {
      const key = randomBytes(32), nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      const certs = [...xml.matchAll(/<c:Certificate>([^<]+)</g)].map(m => new X509Certificate(Buffer.from(m[1], 'base64')));
      const keys = certs.map(cert => seq(integer(0), rid(cert), seq(id(OID.ecies)), octets(encryptEciesKey(key, cert.publicKey))));
      result = seq(id(OID.authEnvelope), tlv(160, seq(integer(0), set(...keys), seq(id(OID.data), seq(id(OID.aes256gcm), seq(octets(nonce), integer(16))), tlv(128, encrypted)), octets(cipher.getAuthTag()), tlv(162, emails))));
      key.fill(0);
    } else {
      const e = readKimEnvelope(data), key = decryptEciesKey(e.keys[0].encryptedKey, encryptionKey);
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, e.nonce); decipher.setAuthTag(e.tag);
        result = Buffer.concat([decipher.update(e.ciphertext), decipher.final()]);
      } finally { key.fill(0); }
    }
    return cmsResponse(op, transform(result, op), xml.match(/RequestID="([^"]+)"/)?.[1]);
  };
}
