// Administration-only importer. Never place an original delivery or generated SQL in public/ or Git.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { crc32, inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseBfarmReference } from '../src/lib/pflege/bfarmCatalogImport.ts';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sqlString = value => "'" + value.replaceAll("'", "''") + "'";
const jsonSql = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";

/** Bounded ZIP reader for the three official UTF-8 DSVs; no filesystem extraction. */
export function readReferenceArchive(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > 64 * 1024 * 1024) throw Error('ZIP-Größe ist ungültig.');
  let eocd = -1;
  for (let i=bytes.length-22; i>=Math.max(0,bytes.length-65557); i--) {
    if (bytes.readUInt32LE(i)===0x06054b50 && i+22+bytes.readUInt16LE(i+20)===bytes.length) { eocd=i; break; }
  }
  if (eocd<0 || bytes.readUInt16LE(eocd+4)!==0 || bytes.readUInt16LE(eocd+6)!==0
    || bytes.readUInt16LE(eocd+8)!==3 || bytes.readUInt16LE(eocd+10)!==3) throw Error('Genau drei originale DSV-Dateien werden benötigt.');
  const directory=bytes.readUInt32LE(eocd+16), directoryEnd=directory+bytes.readUInt32LE(eocd+12);
  if (directoryEnd!==eocd) throw Error('ZIP-Verzeichnis ist ungültig.');
  const files=[], names=new Set(); let cursor=directory;
  for (let i=0;i<3;i++) {
    if (cursor+46>directoryEnd || bytes.readUInt32LE(cursor)!==0x02014b50) throw Error('ZIP-Eintrag ist ungültig.');
    const flags=bytes.readUInt16LE(cursor+8), method=bytes.readUInt16LE(cursor+10), checksum=bytes.readUInt32LE(cursor+16);
    const compressed=bytes.readUInt32LE(cursor+20), size=bytes.readUInt32LE(cursor+24);
    const nameLength=bytes.readUInt16LE(cursor+28), extraLength=bytes.readUInt16LE(cursor+30), commentLength=bytes.readUInt16LE(cursor+32);
    const local=bytes.readUInt32LE(cursor+42), next=cursor+46+nameLength+extraLength+commentLength;
    if (next>directoryEnd || (flags&1) || ![0,8].includes(method) || size<1 || size>64*1024*1024 || compressed>64*1024*1024
      || bytes.readUInt16LE(cursor+34)!==0 || local+30>directory || bytes.readUInt32LE(local)!==0x04034b50) throw Error('ZIP-Eintrag wird nicht unterstützt.');
    const name=bytes.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
    if (!/^\d{8}-REFERENCE_(?:MEDICINAL_PRODUCT|PHARMACEUTICAL_PRODUCT|SUBSTANCE)\.dsv$/.test(name) || names.has(name)) throw Error('Originaldateinamen fehlen oder sind doppelt.');
    names.add(name);
    const localNameLength=bytes.readUInt16LE(local+26), dataOffset=local+30+localNameLength+bytes.readUInt16LE(local+28);
    if (bytes.subarray(local+30,local+30+localNameLength).toString('utf8')!==name
      || bytes.readUInt16LE(local+8)!==method || bytes.readUInt16LE(local+6)!==flags || dataOffset+compressed>directory) throw Error('ZIP-Dateiangaben widersprechen sich.');
    const payload=bytes.subarray(dataOffset,dataOffset+compressed);
    const raw=method===0?payload:inflateRawSync(payload,{maxOutputLength:size});
    if (raw.length!==size || crc32(raw)!==checksum) throw Error('ZIP-Prüfsumme stimmt nicht.');
    files.push({name,text:new TextDecoder('utf-8',{fatal:true}).decode(raw),bytes:raw.length,sha256:sha(raw)});
    cursor=next;
  }
  if (cursor!==directoryEnd) throw Error('ZIP-Verzeichnis ist unvollständig.');
  return files;
}

export function prepareBfarmImport(archivePath, outputDirectory) {
  const archive=fs.readFileSync(archivePath), files=readReferenceArchive(archive);
  const parsed=parseBfarmReference(files), sourceDate=parsed.sourceVersion;
  const rows=parsed.rows.map(row=>({pzn:row.pzn,product:{...row,brand:null,manufacturer:null,packageSize:null,
    source:'bfarm-31b',sourceVersion:sourceDate},components:parsed.componentsByPzn[row.pzn]}));
  const componentCount=rows.reduce((n,row)=>n+row.components.length,0);
  const substanceCount=rows.reduce((n,row)=>n+row.components.reduce((m,c)=>m+c.substances.length,0),0);
  fs.mkdirSync(outputDirectory,{recursive:true,mode:0o700});
  const out=path.resolve(outputDirectory), queries=[];
  const write=(name,query)=>{fs.writeFileSync(path.join(out,name),query+'\n',{mode:0o600});queries.push(name);};
  const manifest={sourceDate,archiveSha256:sha(archive),archiveBytes:archive.length,medicinalCount:rows.length,
    componentCount,substanceCount,missingStrengths:rows.reduce((n,row)=>n+row.components.reduce((m,c)=>m+c.substances.filter(s=>s.strength===null).length,0),0),
    files:files.map(({name,bytes,sha256})=>({name,bytes,sha256}))};
  write('000-delivery.sql',`do $bfarm$ begin
    if exists (select 1 from bfarm_reference.deliveries where source_date=${sqlString(sourceDate)}
      and (archive_sha256,archive_bytes,medicinal_count,component_count,substance_count) is distinct from
      (${sqlString(manifest.archiveSha256)},${archive.length},${rows.length},${componentCount},${substanceCount})) then
      raise exception 'Abweichende Lieferung für dasselbe Datum.'; end if;
    insert into bfarm_reference.deliveries(source_date,archive_sha256,archive_bytes,medicinal_count,component_count,substance_count,file_manifest)
    values (${sqlString(sourceDate)},${sqlString(manifest.archiveSha256)},${archive.length},${rows.length},${componentCount},${substanceCount},${jsonSql(manifest.files)})
    on conflict (source_date) do nothing;
  end $bfarm$;`);
  for(let offset=0,part=0;offset<archive.length;offset+=262144,part++) {
    const chunk=archive.subarray(offset,offset+262144);
    write(`001-archive-${String(part).padStart(3,'0')}.sql`,`insert into bfarm_reference.archive_chunks(source_date,chunk_no,bytes)
      select ${sqlString(sourceDate)},${part},decode('${chunk.toString('hex')}','hex')
      where not exists (select 1 from bfarm_reference.deliveries where source_date=${sqlString(sourceDate)} and verified_at is not null)
      on conflict (source_date,chunk_no) do nothing;`);
  }
  let batch=[], bytes=0, number=0;
  function flush(){
    if(!batch.length)return;
    const payload=jsonSql(batch);
    write(`002-packages-${String(number++).padStart(3,'0')}.sql`,`do $bfarm$ declare data jsonb := ${payload}; begin
      if exists (select 1 from jsonb_to_recordset(data) as i(pzn text,product jsonb,components jsonb)
        join bfarm_reference.packages p on p.source_date=${sqlString(sourceDate)} and p.pzn=i.pzn
        where (p.product,p.components) is distinct from (i.product,i.components)) then
        raise exception 'Abweichende Referenzdaten für dieselbe Lieferung.'; end if;
      insert into bfarm_reference.packages(source_date,pzn,product,components)
        select ${sqlString(sourceDate)},i.pzn,i.product,i.components from jsonb_to_recordset(data) as i(pzn text,product jsonb,components jsonb)
        where not exists (select 1 from bfarm_reference.packages p where p.source_date=${sqlString(sourceDate)} and p.pzn=i.pzn)
        on conflict (source_date,pzn) do nothing;
    end $bfarm$;`);
    batch=[];bytes=0;
  }
  for(const row of rows){const size=Buffer.byteLength(JSON.stringify(row));if(bytes+size>450000)flush();batch.push(row);bytes+=size;}
  flush();
  write('003-activate.sql',`select bfarm_reference.activate_delivery(${sqlString(sourceDate)});`);
  const result={...manifest,queries};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  return result;
}

async function main(){
  const args=process.argv.slice(2), options={};
  for(let i=0;i<args.length;i++){
    if(['--archive','--out','--project'].includes(args[i])&&args[i+1])options[args[i].slice(2)]=args[++i];
    else if(args[i]==='--apply')options.apply=true;
    else throw Error('Aufruf: node scripts/bfarm-reference-import.mjs --archive EXPORT.zip --out PRIVATER_ORDNER [--apply --project PROJEKT]');
  }
  if(!options.archive||!options.out)throw Error('Original-ZIP und privater Ausgabeordner sind erforderlich.');
  const target=path.resolve(options.out), root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  if(target===root||target.startsWith(root+path.sep))throw Error('Importdateien außerhalb des Git-Projekts speichern.');
  const result=prepareBfarmImport(options.archive,target);
  console.log(`BfArM ${result.sourceDate}: ${result.medicinalCount} Präparate, ${result.componentCount} Komponenten, ${result.substanceCount} Wirkstoffzuordnungen. Original-ZIP geprüft.`);
  if(!options.apply)return;
  const token=process.env.SUPABASE_ACCESS_TOKEN;
  if(!token||!/^\w{20}$/.test(options.project??''))throw Error('Für --apply sind Projektkennung und SUPABASE_ACCESS_TOKEN im Prozess erforderlich.');
  for(let i=0;i<result.queries.length;i++){
    const query=fs.readFileSync(path.join(target,result.queries[i]),'utf8');
    const response=await fetch(`https://api.supabase.com/v1/projects/${options.project}/database/query`,{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(120000),
    });
    if(!response.ok)throw Error(`Importteil ${i+1} fehlgeschlagen (HTTP ${response.status}); die bisherige aktive Lieferung bleibt erhalten.`);
    console.log(`Importteil ${i+1}/${result.queries.length} bestätigt.`);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{
  console.error('BfArM-Import nicht abgeschlossen. Originaldatei, Projekt und Administratorzugang prüfen; bei einem Teilimport denselben Befehl erneut ausführen.');process.exitCode=1;
});
