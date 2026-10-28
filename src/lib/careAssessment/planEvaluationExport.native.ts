import {buildEvaluationArchive} from './planEvaluationExport.ts';
import type {EvaluationRecord} from './planEvaluationDomain';
import {deliverNativeArchive} from '@/lib/platform/nativeFileDelivery.native';
type Mode='print'|'html'|'json';
export async function exportEvaluationHistory(records: EvaluationRecord[], tenant: string, assessment: string, client: string, mode: Mode):Promise<void>{await deliverNativeArchive(buildEvaluationArchive(records,tenant,assessment,client,new Date().toISOString()),mode);}
