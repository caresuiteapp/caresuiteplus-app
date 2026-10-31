import {archiveMedicationSource,type ArchiveGateway} from './core.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export class ArchiveHttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export async function bounded<T>(task:PromiseLike<T>,milliseconds=20_000):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve(task),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(Error('Archivantwort fehlt. Dieselbe Anfrage erneut prüfen.')),milliseconds);})]);}finally{if(timer)clearTimeout(timer);}}
async function readBody(req:Request):Promise<{sourceId:string;requestId:string}>{
 const declared=req.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>4096))throw new ArchiveHttpError(413,'Anfrage zu groß.');
 if(!req.body)throw new ArchiveHttpError(400,'Quelle und Anfrage fehlen.');
 const reader=req.body.getReader();const chunks:Uint8Array[]=[];let size=0;const deadline=Date.now()+20_000;
 try{for(;;){const {done,value}=await bounded(reader.read(),Math.max(1,deadline-Date.now()));if(done)break;size+=value.byteLength;if(size>4096)throw new ArchiveHttpError(413,'Anfrage zu groß.');chunks.push(value);}}
 catch(error){void reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ArchiveHttpError(400,'Ungültige Archivanfrage.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==2||!('sourceId' in body)||!('requestId' in body)||!uuid(body.sourceId)||!uuid(body.requestId))throw new ArchiveHttpError(400,'Quelle und Anfrage benötigen gültige IDs.');
 return {sourceId:body.sourceId,requestId:body.requestId};
}
export function createArchiveHandler(createGateway:(authorization:string)=>Promise<ArchiveGateway>){return async(req:Request):Promise<Response>=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({ok:false,error:'Methode nicht erlaubt.'},405);
 const authorization=req.headers.get('authorization');
 if(!authorization?.match(/^Bearer\s+\S+$/i))return response({ok:false,error:'Anmeldung erforderlich.'},401);
 try{
  const body=await readBody(req);const gateway=await createGateway(authorization);
  const result=await archiveMedicationSource(body.sourceId,body.requestId,gateway);
  return response({ok:true,data:result});
 }catch(error){
  if(error instanceof ArchiveHttpError)return response({ok:false,error:error.message},error.status);
  // Lost write acknowledgments stay uncertain; never disclose private backend errors.
  return response({ok:false,error:'Archivierung nicht bestätigt. Quelle, Dateistand und Berechtigung prüfen; bei unklarer Antwort dieselbe Anfrage erneut prüfen.',uncertain:true},409);
 }
};}
