// Web completion contract. A sealed Assist original is not a monthly confirmation,
// byte attestation, permission to dispatch, or evidence of hardware/TI approval.
import { UUID } from './sources';

export type AssistDraft = { proofId: string; updatedAt: string; payloadHash: string; signatureId: string };
export type AssistOriginal = { proofId: string; draftId: string; draftUpdatedAt: string; payloadHash: string; signatureId: string; sealedAt: string };
export type AssistOriginalScope = { tenantId: string; assignmentId: string; actorId: string; employeeId: string | null };
export type AssistOriginalContext = AssistOriginalScope & {
  version: 'gkv-assist-original-v1'; visitId: string;
  phase: 'legacy' | 'working' | 'awaiting_signature' | 'ready' | 'sealed'; draft: AssistDraft | null; original: AssistOriginal | null;
};
export type AssistOriginalRpc = (name: string, input: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
const object = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const date = (v: unknown): v is string => typeof v === 'string' && v.length < 50 && Number.isFinite(Date.parse(v));
const fail = () => new Error('Die persönliche Abschlussfassung wurde nicht eindeutig bestätigt. Bitte den Einsatz erneut prüfen.');
function exact(v: Record<string, unknown>, keys: string[]) {
  return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
}
export function readAssistOriginalContext(value: unknown, scope: AssistOriginalScope): AssistOriginalContext {
  const c = object(value);
  if (!c || !exact(c, ['version','tenantId','assignmentId','actorId','employeeId','visitId','phase','draft','original'])
    || c.version !== 'gkv-assist-original-v1' || !uuid(c.visitId)
    || !uuid(scope.tenantId) || !uuid(scope.assignmentId) || !uuid(scope.actorId)
    || c.tenantId !== scope.tenantId || c.assignmentId !== scope.assignmentId || c.actorId !== scope.actorId
    || c.employeeId !== scope.employeeId || (c.employeeId !== null && !uuid(c.employeeId))) throw fail();
  if (c.phase === 'legacy' || c.phase === 'working' || c.phase === 'awaiting_signature') {
    if (c.draft !== null || c.original !== null) throw fail();
  } else if (c.phase === 'ready') {
    const d = object(c.draft);
    if (!d || !exact(d, ['proofId','updatedAt','payloadHash','signatureId']) || !uuid(d.proofId)
      || !uuid(d.signatureId) || !hash(d.payloadHash) || !date(d.updatedAt) || c.original !== null) throw fail();
  } else if (c.phase === 'sealed') {
    const o = object(c.original);
    if (!o || !exact(o, ['proofId','draftId','draftUpdatedAt','payloadHash','signatureId','sealedAt'])
      || !uuid(o.proofId) || !uuid(o.draftId) || o.proofId === o.draftId || !uuid(o.signatureId)
      || !hash(o.payloadHash) || !date(o.draftUpdatedAt) || !date(o.sealedAt)
      || Date.parse(o.sealedAt) < Date.parse(o.draftUpdatedAt) || c.draft !== null) throw fail();
  } else throw fail();
  return c as AssistOriginalContext;
}
function matches(context: AssistOriginalContext, draft: AssistDraft, visitId: string) {
  const o = context.original;
  return context.phase === 'sealed' && context.visitId === visitId && o?.draftId === draft.proofId
    && o.payloadHash === draft.payloadHash && o.signatureId === draft.signatureId && o.draftUpdatedAt === draft.updatedAt;
}
function errorMessage(error: unknown) {
  const code = object(error)?.code;
  return code === '42501' ? 'Der persönliche Abschluss benötigt den aktiven Zugang der eingesetzten Pflegekraft.'
    : (code === '40001' || code === 'PT409') || code === '23505' ? 'Entwurf, Unterschrift oder persönliche Freigabe wurde geändert. Bitte den Einsatz erneut prüfen.'
    : fail().message;
}
/** Only a definite absent RPC permits the existing unbound workflow. All other
 * errors block handoff. A lost write reply is recovered by reading and matching
 * the exact server original, never by fabricating success or choosing a new draft. */
export async function ensureAssistOriginal(rpc: AssistOriginalRpc, scope: AssistOriginalScope, requestId: string): Promise<AssistOriginalContext | null> {
  if (!uuid(requestId)) throw fail();
  const args = { t: scope.tenantId, a_id: scope.assignmentId };
  const load = (allowMissing = false) => loadAssistOriginalContext(rpc, scope, allowMissing);
  const context = await load(true);
  if (!context || context.phase === 'legacy' || context.phase === 'sealed') return context;
  if (context.phase === 'awaiting_signature') throw new Error('Der Leistungsinhalt ist persönlich erfasst. Die Unterschrift im Klient:innenportal steht noch aus.');
  if (context.phase !== 'ready' || !context.draft) throw new Error('Der Einsatz ist für den persönlichen Originalabschluss noch nicht vollständig beendet.');
  const draft = context.draft;
  try {
    const result = await rpc('gkv_assist_original_seal', { ...args, p_request: requestId, p_expected: draft });
    if (result.error) throw new Error(errorMessage(result.error));
    const sealed = readAssistOriginalContext(result.data, scope);
    if (!matches(sealed, draft, context.visitId)) throw fail();
    return sealed;
  } catch (error) {
    // A second context read performs the same live-session/source/revocation checks.
    try {
      const recovered = await load();
      if (recovered && matches(recovered, draft, context.visitId)) return recovered;
    } catch { /* Keep the original failure; a failed read is never a success. */ }
    throw error;
  }
}
export async function loadAssistOriginalContext(rpc: AssistOriginalRpc, scope: AssistOriginalScope, allowMissing = true): Promise<AssistOriginalContext | null> {
    const result = await rpc('gkv_assist_original_context', { t: scope.tenantId, a_id: scope.assignmentId });
    if (result.error) {
      const e = object(result.error);
      if (allowMissing && e?.code === 'PGRST202' && typeof e.message === 'string'
        && e.message.includes('gkv_assist_original_context')) return null;
      throw new Error(errorMessage(result.error));
    }
    return readAssistOriginalContext(result.data, scope);
}
