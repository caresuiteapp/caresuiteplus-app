import { envelope, CERT, COMMON, remoteError } from './connector-fixture.mjs';
import { CARD_SERVICE, CARD_COMMON } from '../../services/kim/connector-xml.mjs';

export const cardUrl = options => options.url.replace('/CertificateService', '/CardService');
export const isPinStatus = bytes => bytes.includes('<c:GetPinStatus');
export const isVerifyPin = bytes => bytes.includes('<c:VerifyPin');
export function pinResponse(operation = 'GetPinStatus', result = 'VERIFIED', leftTries = null, execution = 'OK') {
  const status = operation === 'GetPinStatus', prefix = status ? 'c' : 'cc';
  return envelope(`<c:${operation}Response><n:Status><n:Result>${execution}</n:Result>${result === 'ERROR' ? remoteError(4064) : ''}</n:Status>`
    + `<${prefix}:${status ? 'PinStatus' : 'PinResult'}>${result}</${prefix}:${status ? 'PinStatus' : 'PinResult'}>`
    + (leftTries === null ? '' : `<${prefix}:LeftTries>${leftTries}</${prefix}:LeftTries>`) + `</c:${operation}Response>`)
    .replace(CERT, CARD_SERVICE).replace(COMMON, CARD_COMMON);
}
