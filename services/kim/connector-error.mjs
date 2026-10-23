/** No SOAP text, context IDs, credentials, certificate subjects or native errors. */
export class KonnektorError extends Error {
  constructor(code, remoteCodes = []) {
    super(code); this.name = 'KonnektorError'; this.code = code;
    this.remoteCodes = Object.freeze([...remoteCodes]);
  }
}
/** The peer reported a successful mutation, but its postconditions could not
 * be confirmed. Callers must not present this as an unchanged PIN or retry it.
 */
export class KonnektorPinMaintenanceError extends KonnektorError {
  constructor(operation, causeCode, remoteCodes = []) {
    super('KIM_CONNECTOR_PIN_MAINTENANCE_UNCONFIRMED', remoteCodes);
    this.name = 'KonnektorPinMaintenanceError';
    this.operation = ['ChangePin', 'UnblockPin'].includes(operation) ? operation : 'unknown';
    this.reportedPinResult = 'OK';
    this.causeCode = /^KIM_CONNECTOR_[A-Z_]{1,40}$/.test(causeCode ?? '') ? causeCode : 'KIM_CONNECTOR_PIN_UNAVAILABLE';
  }
}
export const connectorFail = code => { throw new KonnektorError('KIM_CONNECTOR_' + code); };
export function connectorSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) connectorFail('CONFIGURATION');
  if (signal?.aborted) connectorFail('ABORTED');
}
