import {buildClinicalControlFollowUpArchive} from './clinicalControlFollowUpExport';
import type {ControlRecord} from './clinicalControlGateway';
import type {ControlSource} from './clinicalControlDomain';
import {deliverNativeArchive} from '@/lib/platform/nativeFileDelivery.native';
type Mode='print'|'html'|'json';
export async function exportClinicalControlFollowUp(records: ControlRecord[], tenant: string, client: string, taskId: string, mode: Mode, sources: ControlSource[] | null = null):Promise<void>{await deliverNativeArchive(buildClinicalControlFollowUpArchive(records,tenant,client,taskId,new Date().toISOString(),Date.now(),sources),mode);}
