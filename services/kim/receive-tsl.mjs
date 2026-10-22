import { openEccKimMessage, receiveEccKimMessage } from './client-message.mjs';
import { MAX_KIM_MESSAGE } from './message.mjs';
import { receiveReportContext } from './receive-error.mjs';
import { TslOcspStatusClient } from './tsl-ocsp.mjs';
import { TslError } from './tsl.mjs';
import { checkVzdConfiguration } from './vzd-bindings.mjs';
import { receiveEccKimMessageWithDirectory } from './receive-vzd.mjs';

const fail = code => { throw new TslError(code); };
const copy = value => value instanceof Uint8Array ? Buffer.from(value) : value;
const errorCode = e => e instanceof TslError && /^KIM_(?:TSL|OCSP)_[A-Z_]{1,48}$/.test(e.code) ? e.code : 'KIM_TSL_STATUS_FAILED';

/** Local diagnostic facade for a persisted original. Message cryptography and
 * CMS/header bindings must pass before a status request is made. With a checked
 * directory, OSIG/From binding selects whether AUT must be checked; without a
 * directory, both explicitly pinned certificates remain mandatory. Still no
 * TI identity, normal delivery, SMTP transmission or billing-state transition.
 */
export async function receiveEccKimMessageWithTsl(options, reportOptions, { statusClient, directory, signal } = {}) {
  if (!(statusClient instanceof TslOcspStatusClient) || (signal !== undefined && !(signal instanceof AbortSignal))) fail('KIM_TSL_STATUS_CONFIGURATION');
  if (directory !== undefined) checkVzdConfiguration(directory, statusClient);
  if (signal?.aborted) fail('KIM_TSL_ABORTED');
  if (!(options?.bytes instanceof Uint8Array) || !options.bytes.length || options.bytes.length > MAX_KIM_MESSAGE) fail('KIM_TSL_MESSAGE_SIZE');
  const captured = { ...options, bytes: Buffer.from(options.bytes), now: options.now ?? Date.now(),
    recipientCertificate: copy(options.recipientCertificate), expectedSignerCertificate: copy(options.expectedSignerCertificate),
    expectedAuthCertificate: copy(options.expectedAuthCertificate), ocsp: undefined, directoryRejected: false };
  const report = { ...reportOptions, verificationReport: reportOptions?.verificationReport ? {
    ...reportOptions.verificationReport, bytes: copy(reportOptions.verificationReport.bytes),
  } : undefined };
  let opened;
  try {
    // Validate report options and pass-through classification before network I/O.
    const context = receiveReportContext({ ...report, bytes: captured.bytes, address: captured.address, now: captured.now });
    const isKim = context.outer?.headers.some(h => h.name === 'x-kom-le-version');
    context.original.fill(0); context.verificationReport?.fill(0);
    if (!isKim) return receiveEccKimMessage(captured, report);
    if (directory !== undefined) return await receiveEccKimMessageWithDirectory(captured, report, { statusClient, directory, signal });
    try { opened = openEccKimMessage(captured); }
    catch { return receiveEccKimMessage(captured, report); }
    finally { opened?.message?.fill(0); } // No decrypted message stays live across network waits.
    let ocsp, acquisition;
    try {
      ocsp = await TslOcspStatusClient.prototype.messageEvidence.call(statusClient, { signingCertificate: captured.expectedSignerCertificate,
        authenticationCertificate: captured.expectedAuthCertificate, signal });
      acquisition = Object.freeze({ state: ocsp.failures.length ? 'incomplete' : 'checked', tsl: ocsp.tsl,
        certificateTypes: ocsp.certificateTypes, certificateAdmissions: ocsp.certificateAdmissions, failures: ocsp.failures });
    } catch (e) {
      if (signal?.aborted || e?.code === 'KIM_TSL_ABORTED') fail('KIM_TSL_ABORTED');
      ocsp = {}; acquisition = Object.freeze({ state: 'unavailable', code: errorCode(e) });
    }
    if (signal?.aborted) fail('KIM_TSL_ABORTED');
    // The synchronous receiver verifies each raw proof against the same guarded
    // verifier again; a good flag or a TSL change cannot authorize old evidence.
    return { ...receiveEccKimMessage({ ...captured, ocsp }, report), statusAcquisition: acquisition };
  } finally { captured.bytes.fill(0); report.verificationReport?.bytes?.fill?.(0); }
}
