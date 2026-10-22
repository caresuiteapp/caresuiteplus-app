/** No SOAP text, context IDs, credentials, certificate subjects or native errors. */
export class KonnektorError extends Error {
  constructor(code, remoteCodes = []) {
    super(code); this.name = 'KonnektorError'; this.code = code;
    this.remoteCodes = Object.freeze([...remoteCodes]);
  }
}
export const connectorFail = code => { throw new KonnektorError('KIM_CONNECTOR_' + code); };
export function connectorSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) connectorFail('CONFIGURATION');
  if (signal?.aborted) connectorFail('ABORTED');
}
