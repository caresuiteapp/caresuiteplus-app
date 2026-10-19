import type { RoleKey } from '@/types';
/** Native Android retains the established completion controls unchanged. */
export function CareStopCompletionPanel(_props:{stopId:string;tenantId:string;role?:RoleKey|null;disabled?:boolean;onCompleted:()=>void|Promise<void>}){return null;}

