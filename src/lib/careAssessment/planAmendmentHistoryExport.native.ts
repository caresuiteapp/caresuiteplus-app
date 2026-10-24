import {buildPlanAmendmentArchive,amendmentFieldLabels} from './planAmendmentHistoryExport.ts';
import type {PlanAmendmentHistoryRecord} from './planAmendmentHistoryDomain';
import type {EvaluationRecord} from './planEvaluationDomain';
export {amendmentFieldLabels};
import {deliverNativeArchive} from '@/lib/platform/nativeFileDelivery.native';
type Mode='print'|'html'|'json';
export async function exportPlanAmendmentHistory(records: PlanAmendmentHistoryRecord[], tenant: string, assessment: string, client: string, mode: Mode, evaluations?: EvaluationRecord[]):Promise<void>{await deliverNativeArchive(buildPlanAmendmentArchive(records,tenant,assessment,client,new Date().toISOString(),Date.now(),evaluations),mode);}
