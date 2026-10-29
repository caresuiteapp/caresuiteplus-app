// Deliberately run WITHOUT the TypeScript/register test loader. This imports the
// exact deployed .mjs entry, including under --no-experimental-require-module.
import assert from 'node:assert/strict';
import handler from '../../api/gkv/monthly-originals.mjs';
const body={action:'prepare',tenantId:'81bd07c1-ea07-47c2-998e-b435c395e3a1',
  proofId:'81bd07c1-ea07-47c2-998e-b435c395e3a2',captureId:'81bd07c1-ea07-47c2-998e-b435c395e3a3',revision:1};
for(const [name,request,code,error] of [
  ['GET',{method:'GET',headers:{}},405,'MONTHLY_INPUT'],
  ['unauthenticated POST',{method:'POST',headers:{'content-type':'application/json'},body},401,'MONTHLY_AUTH'],
  ['invalid input',{method:'POST',headers:{'content-type':'application/json'},body:{...body,actorId:body.tenantId}},400,'MONTHLY_INPUT'],
  ['unsupported encoding',{method:'POST',headers:{'content-type':'application/json','content-encoding':'gzip'},body},415,'MONTHLY_INPUT'],
]){
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.value=v;return this;}};
  await handler(request,response);assert.equal(response.code,code);assert.equal(response.value.error,error);
  assert.equal(response.headers['Cache-Control'],'private, no-store');console.log(`ok - deployed gateway: ${name} → ${code}`);
}
