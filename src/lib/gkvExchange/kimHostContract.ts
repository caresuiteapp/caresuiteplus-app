export type KimProbeReport = {
  version: 1; runId: string; startedAt: number; completedAt: number; environment: 'test' | 'production';
  state: 'passed'; profile: 'ecc-cms-diagnostic'; source: 'configured-konnektor';
  challengeSha256: string; contentSha256: string; envelopeSha256: string; transcriptSha256: string;
  certificateSha256: { ref: string; sha256: string }[];
  transcript: { operation: string; requestSha256: string; responseSha256: string; routeSha256: string; contextSha256: string; checkedAt: number }[];
  hardwareEvidence: 'not-attested'; tiEvidence: 'not-attested'; deliveryStatus: 'held-for-trust-validation';
};
export type KimHostStatus = {
  version: 1; tenantId: string; configured: boolean; environment: 'test' | 'production' | null;
  state: 'unconfigured' | 'ready' | 'running' | 'passed' | 'failed' | 'interrupted'; canStart: boolean;
  requestId: string | null; startedAt: number | null; completedAt: number | null; report: KimProbeReport | null; errorCode: string | null;
};
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const time = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
/** Reject scope/claim substitution on both server and browser boundaries. */
export function readKimHostStatus(value: unknown, tenantId: string): KimHostStatus {
  const s = object(value);
  const reject = (): never => { throw new Error('KIM_HOST_RESPONSE'); };
  if (Object.keys(s).some(k => !['version','tenantId','configured','environment','state','canStart','requestId','startedAt','completedAt','report','errorCode'].includes(k))) reject();
  if (JSON.stringify(s).length > 32768 || s.version !== 1 || !uuid(tenantId) || s.tenantId !== tenantId
    || !['unconfigured','ready','running','passed','failed','interrupted'].includes(String(s.state))
    || typeof s.configured !== 'boolean' || typeof s.canStart !== 'boolean') reject();
  if (!s.configured) {
    if (s.state !== 'unconfigured' || s.canStart || ['environment','requestId','startedAt','completedAt','report','errorCode'].some(k => s[k] !== null)) reject();
  } else {
    if (!['test','production'].includes(String(s.environment)) || s.state === 'unconfigured') reject();
    if (s.state === 'ready') {
      if (!s.canStart || ['requestId','startedAt','completedAt','report','errorCode'].some(k => s[k] !== null)) reject();
    } else if (!uuid(s.requestId) || !time(s.startedAt)) reject();
    if (['running','interrupted'].includes(String(s.state)) && ((s.state === 'running' && s.canStart) || s.report !== null || s.completedAt !== null)) reject();
    if (s.state === 'failed' && (!time(s.completedAt) || Number(s.completedAt) < Number(s.startedAt)
      || !/^KIM_(?:CONNECTOR|HOST)_[A-Z_]{1,40}$/.test(String(s.errorCode)) || s.report !== null)) reject();
    if (s.state === 'passed') {
      const r = object(s.report);
      if (Object.keys(r).some(k => !['version','runId','startedAt','completedAt','environment','state','profile','source','challengeSha256','contentSha256','envelopeSha256','transcriptSha256','certificateSha256','transcript','hardwareEvidence','tiEvidence','deliveryStatus'].includes(k))) reject();
      if (!time(s.completedAt) || Number(s.completedAt) < Number(s.startedAt) || s.errorCode !== null || r.version !== 1 || !uuid(r.runId)
        || !time(r.startedAt) || !time(r.completedAt) || Number(r.completedAt) < Number(r.startedAt)
        || Number(r.startedAt) < Number(s.startedAt) || Number(r.completedAt) > Number(s.completedAt)
        || r.environment !== s.environment || r.state !== 'passed' || r.profile !== 'ecc-cms-diagnostic'
        || r.source !== 'configured-konnektor' || r.hardwareEvidence !== 'not-attested' || r.tiEvidence !== 'not-attested'
        || r.deliveryStatus !== 'held-for-trust-validation' || !['challengeSha256','contentSha256','envelopeSha256','transcriptSha256'].every(k => hash(r[k]))) reject();
      if (!Array.isArray(r.certificateSha256) || r.certificateSha256.length !== 3 || r.certificateSha256.some((v, i) => {
        const c = object(v); return Object.keys(c).some(k => !['ref','sha256'].includes(k)) || c.ref !== ['C.AUT','C.ENC','C.SIG'][i] || !hash(c.sha256);
      })) reject();
      if (!Array.isArray(r.transcript) || r.transcript.length !== 4 || r.transcript.some((v, i) => {
        const t = object(v); return Object.keys(t).some(k => !['operation','requestSha256','responseSha256','routeSha256','contextSha256','checkedAt'].includes(k)) || t.operation !== ['GetJobNumber','SignDocument','EncryptDocument','DecryptDocument'][i]
          || !time(t.checkedAt) || !['requestSha256','responseSha256','routeSha256','contextSha256'].every(k => hash(t[k]));
      })) reject();
    } else if (s.report !== null) reject();
  }
  return structuredClone(s) as KimHostStatus;
}
