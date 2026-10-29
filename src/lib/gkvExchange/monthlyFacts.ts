import { readMonthlyXmlContent, monthlyXmlLocalTime, type MonthlyXmlContent } from './monthlyXml';
import type { MonthlyProofPayload } from './monthlyProof';
import { UUID } from './sources';

export type MonthlyFacts = {
  schema: 'gkv-monthly-facts-v1'; boundAt: string; responsibleActorId: string;
  providerReference: string; responsibleReference: string;
  captureProvenance: 'not-attested'; content: MonthlyXmlContent;
  sources: {recordId: string; recordUpdatedAt: string; employeeId: string; employeeNumber: string;
    sourceReceiptSha256: string; mappingReference: string; date: string; sequence: number}[];
};
function fail(): never { throw new Error('Die Fachangaben passen nicht zur gespeicherten Leistungsfassung.'); }
const row = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const reference = (v: unknown) => typeof v === 'string' && v.trim() === v && v.length >= 3 && v.length <= 500 && !/[\p{Cc}\p{Cf}]/u.test(v);
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
export function readMonthlyFacts(value: unknown, payload: MonthlyProofPayload): MonthlyFacts {
  if (!row(value) || Object.keys(value).length !== 8 || value.schema !== 'gkv-monthly-facts-v1'
    || value.captureProvenance !== 'not-attested' || !stamp(value.boundAt)
    || typeof value.responsibleActorId !== 'string' || !UUID.test(value.responsibleActorId)
    || !reference(value.providerReference) || !reference(value.responsibleReference)
    || !Array.isArray(value.sources) || value.sources.length !== payload.records.length) fail();
  const content = readMonthlyXmlContent(value.content, new Date(value.boundAt).toISOString());
  if (content.month !== payload.month || content.serviceType !== payload.serviceType
    || `${content.firstName} ${content.lastName}` !== payload.clientName
    || content.days.reduce((n,d) => n + d.visits.length, 0) !== value.sources.length) fail();
  const seen = new Set<string>(), visits = new Set<string>(), originalVisits = new Set<string>();
  for (const source of value.sources) {
    if (!row(source) || Object.keys(source).length !== 8 || typeof source.recordId !== 'string' || seen.has(source.recordId)
      || !reference(source.mappingReference) || typeof source.sourceReceiptSha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(source.sourceReceiptSha256) || typeof source.employeeNumber !== 'string'
      || !/^[0-9]{9}$/.test(source.employeeNumber)) fail();
    const record = payload.records.find(r => r.recordId === source.recordId);
    const visit = content.days.find(d => d.date === source.date)?.visits.find(v => v.sequence === source.sequence);
    const key = `${source.date}:${source.sequence}`;
    if (!record || source.employeeId !== record.employeeId || source.recordUpdatedAt !== record.updatedAt
      || source.date !== record.serviceDate || !visit || visits.has(key)
      || typeof record.sourceReceipt.visit_id !== 'string' || !UUID.test(record.sourceReceipt.visit_id)
      || originalVisits.has(record.sourceReceipt.visit_id)
      || !stamp(record.sourceReceipt.service_started_at) || !stamp(record.sourceReceipt.service_ended_at)) fail();
    const start = monthlyXmlLocalTime(new Date(record.sourceReceipt.service_started_at).toISOString());
    if (start.slice(0,8) !== record.serviceDate.replaceAll('-','') || start.slice(8,12) !== visit.startTime
      || Date.parse(record.sourceReceipt.service_ended_at) < Date.parse(record.sourceReceipt.service_started_at)
      || Date.parse(record.sourceReceipt.service_ended_at) > Date.parse(value.boundAt)
      || visit.lines.some(l => l.employeeNumbers.length !== 1 || l.employeeNumbers[0] !== source.employeeNumber)
      || visit.lines.reduce((n,l) => n + (l.minutes ?? 0), 0) > record.actualMinutes) fail();
    seen.add(source.recordId); visits.add(key); originalVisits.add(record.sourceReceipt.visit_id);
  }
  return structuredClone(value) as MonthlyFacts;
}
