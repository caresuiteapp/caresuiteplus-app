// Isolated offline XSD backend. The caller caps input/output, V8 heap, Wasm
// memory and wall time. Only the same two pinned official files are registered.
// Read actual XML nodes; the expected application document is never sent here.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifestSha='908ad0933309fc314ad854ede4805d0db3374007924b768b01cb77974536f114';
const ns={l:'http://www.gkv-datenaustausch.de/XMLSchema/PFL_LNW/2.2'};
const origin='https://schemas.invalid/',main='PFL_LNW_2.2.0.xsd',basis='PFL_basis_2.2.0.xsd';
const folder=new URL('./pfl-schema/1.2.0/',import.meta.url),limit=8*1024*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
class Rejected extends Error{}
function need(ok,code){if(!ok)throw new Rejected('MONTHLY_XML_'+code);}
async function inspect(){
 let lib;try{lib=await import('libxml2-wasm');}catch{need(false,'UNAVAILABLE');}
 const {XmlDocument,XsdValidator,XmlBufferInputProvider,xmlRegisterInputProvider,ParseOption}=lib;
 const option=ParseOption.XML_PARSE_NO_XXE|ParseOption.XML_PARSE_NONET|ParseOption.XML_PARSE_NO_SYS_CATALOG;
 const files={};
 try{
  const mb=readFileSync(new URL('manifest.json',folder));need(sha(mb)===manifestSha,'SCHEMA_INTEGRITY');
  const entries=JSON.parse(mb).files;need(Object.keys(entries).length===2&&[main,basis].every(n=>Object.hasOwn(entries,n)),'SCHEMA_INTEGRITY');
  for(const n of [main,basis]){const b=readFileSync(new URL(n,folder));need(sha(b)===entries[n],'SCHEMA_INTEGRITY');files[origin+n]=b;}
 }catch{need(false,'SCHEMA_INTEGRITY');}
 const chunks=[];let size=0;
 for await(const chunk of process.stdin){size+=chunk.length;need(size<=limit,'LIMIT');chunks.push(chunk);}
 need(size>0,'LIMIT');const bytes=Buffer.concat(chunks);need(!bytes.subarray(0,3).equals(Buffer.from([239,187,191])),'ENCODING');
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 need(!xml.includes('<!DOCTYPE')&&!xml.includes('<!ENTITY'),'DTD');
 const decl=xml.match(/^<\?xml\s[\s\S]*?\?>/);
 if(decl){need(/\bversion\s*=\s*(['"])1\.0\1/.test(decl[0]),'ENCODING');const enc=decl[0].match(/\bencoding\s*=\s*(['"])([^'"]+)\1/);need(!enc||enc[2].toUpperCase()==='UTF-8','ENCODING');}
 let doc,schema,schemaDoc;
 try{
  need(xmlRegisterInputProvider(new XmlBufferInputProvider(files)),'SCHEMA_IMPORT');
  schemaDoc=XmlDocument.fromBuffer(files[origin+main],{url:origin+main,option});schema=XsdValidator.fromDoc(schemaDoc);
  doc=XmlDocument.fromBuffer(bytes,{option});const root=doc.root,count=x=>Number(doc.eval('count('+x+')',ns));
  need(root.name==='Leistungsnachweis'&&root.namespaceUri===ns.l,'PROFILE');
  need(count('//@* | //processing-instruction() | //comment()')===0,'PROFILE');
  need(count('//*')<=100000&&count('//*[count(ancestor::*)>12]')===0,'LIMIT');
  need(count('//*[not(*) and not(self::l:Datei) and string-length(.)>1024]')===0&&count('//l:Datei[string-length(.)>2796204]')===0,'LIMIT');
  need(count('//*[*]/text()[normalize-space(.)!=""]')===0,'PROFILE');
  try{schema.validate(doc);}catch{need(false,'XSD');}
  const children=(node,name)=>node.find('l:'+name,ns);
  const one=(node,name)=>{const list=children(node,name);need(list.length===1,'PROFILE');return list[0];};
  const text=(node,name)=>one(node,name).content;
  const data=one(root,'Erbrachte_Leistungen'),month=text(data,'Abrechnungsmonat');
  const days=children(one(data,'Leistungen'),'Tag').map(day=>{
   const d=text(day,'Datum');
   return {date:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6),visits:children(day,'Einsatz').map(visit=>({
    sequence:Number(text(visit,'Lfd_Nummer')),startTime:text(visit,'Uhrzeit_Beginn'),lines:children(visit,'Einzelleistung').map(line=>{
     const quantity=children(line,'Anzahl');return {code:text(line,'Leistungsziffer'),description:text(line,'Bezeichnung_der_Leistung'),
      employeeNumbers:children(line,'Beschaeftigtennummer').map(n=>n.content),...(quantity.length?{quantity:quantity[0].content}:{minutes:Number(text(line,'Tatsaechliche_Dauer'))})};
    })
   }))};
  });
  const s=one(root,'Unterschrift_Versicherter'),type=text(s,'Art_der_Unterschrift'),file=one(s,'Unterschrift');
  need(type==='1'||type==='3','UNSUPPORTED_SIGNATURE');const encoded=text(file,'Datei'),binary=Buffer.from(encoded,'base64');
  need(binary.length>0&&binary.length<=2097152&&binary.toString('base64')===encoded,'BINARY');
  const stamp=children(s,'Datum_Uhrzeit_der_Unterschrift');
  return {engine:'libxml2-wasm/0.7.2',sha256:sha(bytes),schemaSha256:manifestSha,document:{proofId:text(root,'Leistungsnachweis_ID'),providerIk:text(data,'IK_Pflegedienst'),
   month:month.slice(0,4)+'-'+month.slice(4),insuranceNumber:text(data,'Versichertennummer'),lastName:text(data,'Name'),firstName:text(data,'Vorname'),
   serviceType:days[0].visits[0].lines[0].code.slice(0,2),responsibleEmployeeNumber:text(data,'Beschaeftigtennumer_verantwortliche_Fachkraft'),days,
   signature:{type,fileType:text(file,'Dateityp'),base64:encoded,...(stamp.length?{signedLocalTime:stamp[0].content}:{})}}};
 }finally{doc?.dispose();schema?.dispose();schemaDoc?.dispose();}
}
try{process.stdout.write(JSON.stringify(await inspect()));}
catch(e){process.stdout.write(JSON.stringify({error:e instanceof Rejected?e.message:'MONTHLY_XML_REJECTED'}));}
