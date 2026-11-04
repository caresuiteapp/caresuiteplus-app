import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>null}));
import {computeVisitProofPayloadHash} from '@/lib/assist/assistVisitProofPersistenceService';
it('hashes only the JSON sent to the server, with the same array order and Unicode bytes',async()=>{
  const payload={z:undefined,title:'Prüfung 🖊',tasks:[{title:'Küche',note:undefined},undefined,null]};
  const independent='sha256:'+createHash('sha256').update('{"tasks":[{"title":"Küche"},null,null],"title":"Prüfung 🖊"}','utf8').digest('hex');
  expect(await computeVisitProofPayloadHash(payload)).toBe(independent);
  expect(await computeVisitProofPayloadHash(JSON.parse(JSON.stringify(payload)))).toBe(independent);
});
