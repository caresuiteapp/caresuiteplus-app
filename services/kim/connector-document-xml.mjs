/** Explicit ECC diagnostic profile. No RSA fallback or external document references. */
export const SIGNATURE_SERVICE = 'http://ws.gematik.de/conn/SignatureService/v7.5';
export const ENCRYPTION_SERVICE = 'http://ws.gematik.de/conn/EncryptionService/v6.1';
export const DOCUMENT_OPERATIONS = Object.freeze(['GetJobNumber', 'SignDocument', 'EncryptDocument', 'DecryptDocument', 'VerifyDocument']);
export const CMS_TYPE = 'urn:ietf:rfc:5652';
export const CMS_XML_LIMIT = 32 * 1024 * 1024;
export function documentBody(operation, ctx, input, escape) {
  const data = `<dss:Base64Data MimeType="application/octet-stream">${input.data?.toString('base64')}</dss:Base64Data>`;
  const prop = `<dss:Property><dss:Identifier>urn:oid:1.2.276.0.76.4.173</dss:Identifier><dss:Value><CMSAttribute>${input.recipientEmails?.toString('base64')}</CMSAttribute></dss:Value></dss:Property>`;
  if (operation === 'GetJobNumber') return ctx;
  if (operation === 'VerifyDocument') return `${ctx}<c:OptionalInputs><c:UseVerificationTime><dss:CurrentTime/></c:UseVerificationTime><vr:ReturnVerificationReport xmlns:vr="urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:schema#"><vr:IncludeVerifier>false</vr:IncludeVerifier><vr:IncludeCertificateValues>true</vr:IncludeCertificateValues><vr:IncludeRevocationValues>true</vr:IncludeRevocationValues><vr:ExpandBinaryValues>false</vr:ExpandBinaryValues><vr:ReportDetailLevel>urn:oasis:names:tc:dss-x:1.0:profiles:verificationreport:reportdetail:allDetails</vr:ReportDetailLevel></vr:ReturnVerificationReport></c:OptionalInputs><dss:SignatureObject><dss:Base64Signature Type="${CMS_TYPE}">${input.data.toString('base64')}</dss:Base64Signature></dss:SignatureObject><c:IncludeRevocationInfo>false</c:IncludeRevocationInfo>`;
  if (operation === 'SignDocument') return `<n:CardHandle>${escape(input.cardHandle)}</n:CardHandle><c:Crypt>ECC</c:Crypt>${ctx}<c:TvMode>NONE</c:TvMode><c:JobNumber>${escape(input.jobNumber)}</c:JobNumber><c:SignRequest RequestID="${escape(input.requestId)}"><c:OptionalInputs><dss:SignatureType>${CMS_TYPE}</dss:SignatureType><dss:Properties><dss:SignedProperties>${prop}</dss:SignedProperties></dss:Properties><c:IncludeEContent>true</c:IncludeEContent></c:OptionalInputs><c:Document>${data}</c:Document><c:IncludeRevocationInfo>false</c:IncludeRevocationInfo></c:SignRequest>`;
  if (operation === 'EncryptDocument') return `${ctx}<c:RecipientKeys>${input.certificates.map(c => `<c:Certificate>${c.toString('base64')}</c:Certificate>`).join('')}</c:RecipientKeys><n:Document>${data}</n:Document><c:OptionalInputs><c:EncryptionType>${CMS_TYPE}</c:EncryptionType><c:UnprotectedProperties>${prop}</c:UnprotectedProperties></c:OptionalInputs>`;
  if (operation === 'DecryptDocument') return `${ctx}<c:PrivateKeyOnCard><n:CardHandle>${escape(input.cardHandle)}</n:CardHandle><c:KeyReference>C.ENC</c:KeyReference></c:PrivateKeyOnCard><n:Document>${data}</n:Document>`;
  throw new Error('KIM_CONNECTOR_INPUT');
}
