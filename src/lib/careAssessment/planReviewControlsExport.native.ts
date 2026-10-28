import {buildPlanReviewControlsArchive} from './planReviewControlsExport.ts';
import type {EvaluationPlan,EvaluationRecord} from './planEvaluationDomain';
import type {ControlRecord} from '../pflege/clinicalControlGateway';
import type {ControlSource} from '../pflege/clinicalControlDomain';
import {deliverNativeArchive} from '@/lib/platform/nativeFileDelivery.native';
type Mode='print'|'html'|'json';
export async function exportPlanReviewControls(plan: EvaluationPlan, evaluations: EvaluationRecord[], controls: ControlRecord[], tenant: string, assessment: string, client: string, mode: Mode, sources: ControlSource[] | null = null):Promise<void>{await deliverNativeArchive(buildPlanReviewControlsArchive(plan,evaluations,controls,tenant,assessment,client,new Date().toISOString(),Date.now(),sources),mode);}
