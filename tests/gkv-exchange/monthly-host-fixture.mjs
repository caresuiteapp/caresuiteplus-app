// Isolated Supabase Auth/source-resolution doubles around the actual SQL,
// pgcrypto MACs and session rows. No connected Supabase or patient data.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {randomUUID,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
export function signingPng(variant=1){
  const png=new PNG({width:320,height:120});png.data.fill(255);
  for(let x=20;x<290;x++){const y=50+Math.round(18*Math.sin((x+variant*7)/(15+variant))+x/12);
    for(let d=0;d<3;d++){const n=((y+d)*320+x)*4;png.data.fill(24,n,n+3);}}
  return PNG.sync.write(png).toString('base64');
}
export async function monthlyHostFixture(){
  const db=new PGlite({extensions:{pgcrypto}}),tenant=randomUUID(),actorId=randomUUID(),sessionId=randomUUID(),otherActor=randomUUID(),otherSession=randomUUID();
  const workerKey=randomBytes(32),workerKeyId=randomUUID(),authKey=randomBytes(32),employee=randomUUID(),calls=[];
  const config={url:'https://monthly-auth.test',key:'fixture-publishable-key'};
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA care_security; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated,anon,service_role;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
    CREATE TABLE fixture_access(actor_id uuid,tenant_id uuid,can_read boolean,can_write boolean,can_review boolean DEFAULT true);
    CREATE FUNCTION care_security.gkv_exchange_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
      SELECT coalesce((SELECT CASE WHEN p='office.invoices.view' THEN can_read WHEN p='office.invoices.create' THEN can_write WHEN p='office.clients.edit' THEN can_review ELSE false END
       FROM public.fixture_access WHERE actor_id=auth.uid() AND tenant_id=t),false) $$;
    CREATE TABLE tenants(id uuid PRIMARY KEY); CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
    CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
    CREATE TABLE service_records(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,updated_at timestamptz,service_date date,status text,actual_minutes integer,source_receipt jsonb,verified_fixture boolean);
    CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,payload_hash text,payload_snapshot jsonb);
    CREATE FUNCTION care_security.office_invoice_assert_source(s public.service_records,b boolean) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN IF s.verified_fixture IS DISTINCT FROM true OR b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Source verifier rejected'; END IF; END $$;`);
  await db.query('INSERT INTO tenants VALUES($1)',[tenant]);
  await db.query("INSERT INTO employees VALUES($1,$2,'Fiktive','Pflegekraft')",[employee,tenant]);
  await db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL),($3,$4,NULL)',[sessionId,actorId,otherSession,otherActor]);
  await db.query('INSERT INTO fixture_access VALUES($1,$2,true,true),($3,$2,true,false)',[actorId,tenant,otherActor]);
  for(const file of ['monthly-proofs-draft.sql','monthly-workspace-draft.sql','monthly-original-verifier-draft.sql','monthly-worker-bridge-draft.sql','monthly-authorities-draft.sql'])
    await db.exec(await readFile(new URL('../../docs/gkv/sql/'+file,import.meta.url),'utf8'));
  await db.query("INSERT INTO care_security.gkv_monthly_responsibilities VALUES($1,$2,now()+interval '1 day',NULL,$2,'Fiktive Beauftragung')",[tenant,actorId]);
  await db.query("INSERT INTO care_security.gkv_monthly_worker_keys VALUES($1,$2,$3,now()+interval '1 day',NULL)",[tenant,workerKeyId,workerKey]);
  const claims=(overrides={})=>({sub:actorId,session_id:sessionId,iss:config.url+'/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...overrides});
  const token=(overrides={})=>{const body=[{alg:'HS256',typ:'JWT'},claims(overrides)].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return body+'.'+createHmac('sha256',authKey).update(body).digest('base64url');};
  const decode=authorization=>{
    if(typeof authorization!=='string' || !authorization.startsWith('Bearer '))throw Error('Unauthorized');
    const parts=authorization.slice(7).split('.'),mac=createHmac('sha256',authKey).update(parts.slice(0,2).join('.')).digest();
    const supplied=Buffer.from(parts[2]||'','base64url');if(mac.length!==supplied.length || !timingSafeEqual(mac,supplied))throw Error('Unauthorized');
    const value=JSON.parse(Buffer.from(parts[1],'base64url'));if(value.exp<Date.now()/1000 || ![actorId,otherActor].includes(value.sub))throw Error('Unauthorized');return value;
  };
  let queue=Promise.resolve();
  const as=async (identity,sql,args=[])=>{
    const result=queue.then(async()=>{await db.exec('BEGIN');try{
      await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(identity)]);await db.exec('SET LOCAL ROLE authenticated');
      const result=await db.query(sql,args);await db.exec('COMMIT');return result;
    }catch(error){await db.exec('ROLLBACK');throw error;}});queue=result.catch(()=>{});return result;
  };
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const http=async(url,options)=>{
    calls.push({url,options});let identity;try{identity=decode(options.headers.Authorization);}catch{return json({},401);}
    if(url===config.url+'/auth/v1/user')return json({id:identity.sub,is_anonymous:false});
    if(url!==config.url+'/rest/v1/rpc/gkv_monthly_worker_command')throw Error('Unexpected URL');
    const {p_envelope,p_mac}=JSON.parse(options.body);
    try{return json((await as(identity,'SELECT public.gkv_monthly_worker_command($1,$2) value',[p_envelope,p_mac])).rows[0].value);}
    catch(error){return json({code:error.code},error.code==='42501'?403:400);}
  };
  const command=async(action,input,requestId=randomUUID(),identity=claims())=>(await as(identity,'SELECT public.gkv_monthly_proof_command($1,$2,$3,$4::jsonb) value',[tenant,requestId,action,JSON.stringify(input)])).rows[0].value;
  async function proof({clientId=randomUUID(),serviceType='01'}={}){
    const client=clientId,record=randomUUID(),visit=randomUUID();
    await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Fiktive','Person') ON CONFLICT DO NOTHING",[client,tenant]);
    const receipt={tenant_id:tenant,client_id:client,employee_id:employee,proof_id:visit,proof_payload_hash:'sha256:'+'a'.repeat(64),visit_id:visit};
    await db.query("INSERT INTO service_records VALUES($1,$2,$3,$4,'2026-10-03T12:00Z','2026-10-03','approved',45,$5,true)",[record,tenant,client,employee,JSON.stringify(receipt)]);
    await db.query('INSERT INTO assist_visit_proofs VALUES($1,$2,$1,$3,$4)',[visit,tenant,receipt.proof_payload_hash,JSON.stringify({documentationNote:'Vollständige Unterstützung bei der Körperpflege.',tasks:[]})]);
    const p=await command('create',{new_id:randomUUID(),client_id:client,month:'2026-10',service_type:serviceType,source_ids:[record]});
    return {p,input:{tenantId:tenant,proofId:p.id,revision:p.revision,captureId:randomUUID()}};
  }
  const authority=async(proofId,action,input={},identity=claims())=>(await as(identity,'SELECT public.gkv_monthly_authority_command($1,$2,$3::jsonb) value',[tenant,action,JSON.stringify({proofId,...input})])).rows[0].value;
  return {authority,db,tenant,actorId,sessionId,otherActor,otherSession,workerKey,workerKeyId,config,calls,http,claims,token,as,command,proof,close:()=>db.close()};
}
