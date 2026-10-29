import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { jsPDF } from 'jspdf';
import { generateMonthlyXml, verifyMonthlyXml, MONTHLY_XML_LIMIT, MONTHLY_XML_SCHEMA_SHA256 } from '../../services/gkv/monthly-xml.mjs';
import { readMonthlyXmlDocument, monthlyXmlLocalTime, MONTHLY_XML_PROFILE } from '../../src/lib/gkvExchange/monthlyXml.ts';
import { signingPng } from './monthly-host-fixture.mjs';
import { finalProof, signedProof } from './monthly-fixtures.mjs';

const checkedAt = '2026-10-29T14:00:00Z';
const sha = b => createHash('sha256').update(b).digest('hex');
function fixture(serviceType = '01') {
  return { proofId: '00000000-0000-4000-8000-000000000001', providerIk: '123456789', month: '2026-10',
    insuranceNumber: 'A123456789', lastName: 'Test & Prüfung', firstName: 'Erika', serviceType,
    responsibleEmployeeNumber: '987654321', days: [{date:'2026-10-03',visits:[{sequence:1,startTime:'0900',lines:[
      {code:`${serviceType}01001`, description:'Körperpflege <vereinbart> & Hilfe', quantity:'1.00',employeeNumbers:['123456789']},
      {code:`${serviceType}02002`, description:'Zeitbezogene Hilfe',minutes:30,employeeNumbers:['123456789','234567891','345678912']},
    ]}]}], signature: {type:'1',signedLocalTime:'20261003120000',fileType:'3',base64:signingPng(91)} };
}
let document, generated;
before(async () => { document=fixture(); generated=await generateMonthlyXml(document,{checkedAt}); });
const rejected = code => e => e?.code === 'MONTHLY_XML_' + code;
const verify = (bytes, expected = document, options = {}) => verifyMonthlyXml(bytes, {expected,checkedAt,...options});
const changed = fn => Buffer.from(fn(generated.bytes.toString('utf8')));

test('LNW: actual official XSD, TA fields and exact content match, with no signature/release claim', async () => {
  assert.equal(generated.verification.sha256,sha(generated.bytes));
  assert.equal(generated.verification.schemaSha256,MONTHLY_XML_SCHEMA_SHA256);
  assert.equal(generated.verification.embeddedFileSha256,sha(Buffer.from(document.signature.base64,'base64')));
  assert.equal(generated.verification.schemaValid,true);
  assert.equal(generated.verification.fieldRulesValid,true);
  assert.equal(generated.verification.expectedContentMatches,true);
  for (const field of ['sourceBindingVerified','componentSignatureVerified','dispatchReady']) assert.equal(generated.verification[field],false);
  assert.ok(Object.isFrozen(generated.verification));
  assert.match(generated.bytes.toString(),/Körperpflege &lt;vereinbart&gt; &amp; Hilfe/);
  assert.match(generated.bytes.toString(),/Beschaeftigtennumer_verantwortliche_Fachkraft/);
  assert.deepEqual((await generateMonthlyXml(document,{checkedAt})).bytes,generated.bytes);
});

for (const type of ['01','07','10']) test(`LNW: separate ${type} document and mixed quantity/minutes with up to three employees`,async()=>{
  const d=fixture(type), result=await generateMonthlyXml(d,{checkedAt});
  assert.equal((await verify(result.bytes,d)).sha256,result.verification.sha256);
});

test('LNW: independent parse accepts namespace prefixes and harmless layout without changing original hash',async()=>{
  const bytes=changed(s=>s.replace('xmlns=','xmlns:p=').replace(/<(\/?)([A-Za-z_][A-Za-z0-9_]*)(?=[ >])/g,'<$1p:$2').replaceAll('><','>\n<'));
  const result=await verify(bytes);
  assert.notEqual(result.sha256,generated.verification.sha256);
  assert.equal(result.sha256,sha(bytes));
});

test('LNW: scanned representative profile embeds all PDF pages, never just the signature crop',async()=>{
  const pdf=new jsPDF(); pdf.text('SYNTHETIC paper LNW page 1',20,20);pdf.addPage();pdf.text('SYNTHETIC confirmation page 2',20,20);
  const bytes=Buffer.from(pdf.output('arraybuffer')), d=fixture();
  d.signature={type:'3',fileType:'2',base64:bytes.toString('base64')};
  const result=await generateMonthlyXml(d,{checkedAt});
  assert.equal(result.verification.embeddedFileSha256,sha(bytes));
  assert.ok(result.bytes.includes(Buffer.from(bytes.toString('base64'))));
  assert.ok(!result.bytes.includes(Buffer.from('Datum_Uhrzeit_der_Unterschrift')));
  d.signature.signedLocalTime='20261003120000';await generateMonthlyXml(d,{checkedAt});
});

for (const [name, modify, code] of [
  ['missing required IK',s=>s.replace(/<IK_Pflegedienst>.*?<\/IK_Pflegedienst>/,''),'XSD'],
  ['duplicate patient name',s=>s.replace('</Name>','</Name><Name>Other</Name>'),'XSD'],
  ['unknown element',s=>s.replace('</Leistungsnachweis>','<Other/></Leistungsnachweis>'),'XSD'],
  ['wrong official namespace',s=>s.replaceAll('/PFL_LNW/2.2','/PFL_LNW/9.9'),'PROFILE'],
  ['corrected spelling is not the official element',s=>s.replaceAll('Beschaeftigtennumer_verantwortliche_Fachkraft','Beschaeftigtennummer_verantwortliche_Fachkraft'),'XSD'],
  ['wrong element order',s=>s.replace(/(<Name>.*?<\/Name>)(<Vorname>.*?<\/Vorname>)/,'$2$1'),'XSD'],
  ['wrong MIME key for image',s=>s.replace('<Dateityp>3</Dateityp>','<Dateityp>2</Dateityp>'),'SIGNATURE'],
  ['missing actual signature time',s=>s.replace(/<Datum_Uhrzeit_der_Unterschrift>.*?<\/Datum_Uhrzeit_der_Unterschrift>/,''),'SIGNATURE'],
  ['XSD character-class loophole',s=>s.replace('<Leistungsziffer>0101001','<Leistungsziffer>0100001'),'FIELD'],
  ['mixed service type within one LNW',s=>s.replace('<Leistungsziffer>0102002','<Leistungsziffer>0702002'),'SERVICE_TYPE'],
  ['minutes supplied for unit service',s=>s.replace('<Anzahl>1.00</Anzahl>','<Tatsaechliche_Dauer>30</Tatsaechliche_Dauer>'),'MEASURE'],
  ['unit count supplied for timed service',s=>s.replace('<Tatsaechliche_Dauer>30</Tatsaechliche_Dauer>','<Anzahl>1.00</Anzahl>'),'MEASURE'],
  ['both unit count and duration',s=>s.replace('</Anzahl>','</Anzahl><Tatsaechliche_Dauer>30</Tatsaechliche_Dauer>'),'XSD'],
  ['duplicate employee number',s=>s.replace('234567891','123456789'),'DUPLICATE_EMPLOYEE'],
  ['nonsequential visit',s=>s.replace('<Lfd_Nummer>1','<Lfd_Nummer>2'),'SEQUENCE'],
  ['day outside accounting month',s=>s.replace('<Datum>20261003','<Datum>20260903'),'DATE'],
  ['impossible calendar date',s=>s.replaceAll('202610','202602').replace('<Datum>20260203','<Datum>20260231'),'DATE'],
  ['future time on processing day',s=>s.replace('<Datum>20261003','<Datum>20261029').replace('<Uhrzeit_Beginn>0900','<Uhrzeit_Beginn>2300'),'FUTURE'],
  ['image confirmation before care visit',s=>s.replace('20261003120000','20261003080000'),'SIGNATURE_TIME'],
  ['future signature',s=>s.replace('20261003120000','20261030120000'),'SIGNATURE_TIME'],
  ['wrong patient with otherwise valid XSD',s=>s.replace('A123456789','B123456789'),'CONTENT_BINDING'],
  ['another proof UUID',s=>s.replace('000000000001</Leistungsnachweis_ID>','000000000002</Leistungsnachweis_ID>'),'CONTENT_BINDING'],
  ['changed amount',s=>s.replace('<Anzahl>1.00','<Anzahl>2.00'),'CONTENT_BINDING'],
  ['changed responsible employee',s=>s.replace('987654321','987654322'),'CONTENT_BINDING'],
  ['another well-formed signature image',s=>s.replace(document?.signature.base64 ?? fixture().signature.base64,signingPng(92)),'CONTENT_BINDING'],
]) test(`LNW: rejects ${name}`,async()=>{ await assert.rejects(verify(changed(modify)),rejected(code)); });

for (const [name, modify, code] of [
  ['external entity',s=>s.replace('?><','?><!DOCTYPE Leistungsnachweis [<!ENTITY x SYSTEM "file:///etc/passwd">]><'),'DTD'],
  ['recursive entity',s=>s.replace('?><','?><!DOCTYPE Leistungsnachweis [<!ENTITY x "&x;">]><'),'DTD'],
  ['stylesheet instruction',s=>s.replace('?><','?><?xml-stylesheet href="https://example.invalid/a.xsl"?><'),'PROFILE'],
  ['comment',s=>s.replace('</Name>','</Name><!-- hidden -->'),'PROFILE'],
  ['schemaLocation override',s=>s.replace('<Leistungsnachweis xmlns=', '<Leistungsnachweis xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://example.invalid/bypass.xsd" xmlns='),'PROFILE'],
  ['XInclude',s=>s.replace('</Name>','</Name><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/>'),'PROFILE'],
  ['ID wrapping',s=>s.replace('<Erbrachte_Leistungen>','<Erbrachte_Leistungen Id="other">'),'PROFILE'],
  ['declared non-UTF8 encoding',s=>s.replace('encoding="UTF-8"','encoding="ISO-8859-1"'),'ENCODING'],
  ['XML 1.1',s=>s.replace('version="1.0"','version="1.1"'),'ENCODING'],
  ['UTF8 BOM',s=>'\uFEFF'+s,'ENCODING'],
]) test(`LNW: rejects ${name} without resolving or disclosing it`,async()=>{ await assert.rejects(verify(changed(modify)),rejected(code)); });

test('LNW: invalid UTF8 and trailing content fail with fixed errors',async()=>{
  for(const bytes of [Buffer.concat([generated.bytes,Buffer.from([255])]),Buffer.concat([generated.bytes,Buffer.from('<extra/>')])]){
    await assert.rejects(verify(bytes),e=>e?.code==='MONTHLY_XML_REJECTED' && !e.message.includes('Erika'));
  }
});
test('LNW: changed input buffers and models during worker execution do not change the verified content',async()=>{
  const bytes=Buffer.from(generated.bytes), expected=structuredClone(document), promise=verify(bytes,expected);
  bytes.fill(0);expected.insuranceNumber='B123456789';expected.signature.base64=signingPng(92);
  assert.equal((await promise).sha256,generated.verification.sha256);
});
test('LNW: unavailable runtime and aborted requests never issue a check receipt',async()=>{
  await assert.rejects(verify(generated.bytes,document,{python:'/nonexistent-caresuite-python'}),rejected('UNAVAILABLE'));
  await assert.rejects(verify(generated.bytes,document,{signal:AbortSignal.abort()}),rejected('ABORTED'));
  const controller=new AbortController(), promise=verify(generated.bytes,document,{signal:controller.signal});controller.abort();
  await assert.rejects(promise,rejected('ABORTED'));
});
test('LNW: current schema is bounded by the official validity window',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../services/gkv/pfl-schema/1.2.0/manifest.json',import.meta.url),'utf8'));
  for(const key of ['logicalVersion','validFrom','validUntil'])assert.equal(MONTHLY_XML_PROFILE[key],manifest[key]);
  for(const stamp of ['2026-04-30T12:00:00Z','2027-02-01T00:00:00Z']) await assert.rejects(verify(generated.bytes,document,{checkedAt:stamp}),rejected('VERSION'));
  assert.equal(monthlyXmlLocalTime('2026-10-24T23:30:00Z'),'20261025013000');
  assert.equal(monthlyXmlLocalTime('2026-10-25T02:30:00Z'),'20261025033000');
  assert.throws(()=>monthlyXmlLocalTime('2026-02-31T12:00:00Z'),rejected('TIME'));
  assert.throws(()=>monthlyXmlLocalTime('2026-10-29T12:00:00'),rejected('TIME'));
});
test('LNW: old monthly confirmations cannot be silently promoted to a normative XML record',async()=>{
  for(const source of [finalProof(),signedProof()]) await assert.rejects(generateMonthlyXml(source,{checkedAt}),rejected('INPUT'));
});
test('LNW: daylight saving gaps fail; repeated autumn wall times do not invent a UTC offset',async()=>{
  const gap=fixture();gap.month='2026-03';gap.days[0].date='2026-03-29';gap.days[0].visits[0].startTime='0230';
  assert.throws(()=>readMonthlyXmlDocument(gap,checkedAt),rejected('TIME'));
  const overlap=fixture();overlap.days[0].date='2026-10-25';overlap.days[0].visits[0].startTime='0130';
  overlap.signature.signedLocalTime='20261025024500';
  await generateMonthlyXml(overlap,{checkedAt:'2026-10-25T01:15:00Z'});
});
test('LNW: unsupported confirmation methods, cropped paper images and invalid binary data stay blocked',async()=>{
  for(const type of ['2','4','5']) {const d=fixture();d.signature.type=type;await assert.rejects(generateMonthlyXml(d,{checkedAt}),rejected('UNSUPPORTED_SIGNATURE'));}
  const paper=fixture();paper.signature={type:'3',fileType:'2',base64:paper.signature.base64};
  await assert.rejects(generateMonthlyXml(paper,{checkedAt}),rejected('PDF'));
  const image=fixture();image.signature.base64=Buffer.from('not a PNG').toString('base64');
  await assert.rejects(generateMonthlyXml(image,{checkedAt}),rejected('PNG'));
  for(const base64 of ['QQ===','QQ==\n','QR==']) {const d=fixture();d.signature.base64=base64;await assert.rejects(generateMonthlyXml(d,{checkedAt}),rejected('BINARY'));}
});
test('LNW: bounded arrays, fields and byte sizes',async()=>{
  const cases=[
    d=>{d.days[0].visits[0].lines[0].employeeNumbers.push('456789123','567891234','678912345');},
    d=>{d.days[0].visits=Array(100).fill(d.days[0].visits[0]);},
    d=>{d.days=Array(32).fill(d.days[0]);},
    d=>{d.signature.base64='A'.repeat(2796208);},
    d=>{d.days[0].visits[0].lines[0].description='a'.repeat(151);},
    d=>{d.days[0].visits[0].lines[0].description='hidden\u202econtrol';},
    d=>{d.days[0].visits[0].lines[0].quantity='99999.00';},
    d=>{d.days[0].visits[0].lines[1].minutes=1441;},
    d=>{d.days[0].visits[0].lines[0].quantity='0.00';},
  ];
  for(const modify of cases){const d=fixture();modify(d);assert.throws(()=>readMonthlyXmlDocument(d,checkedAt));}
  for(const bytes of [Buffer.alloc(0),Buffer.alloc(MONTHLY_XML_LIMIT+1)]) await assert.rejects(verify(bytes),rejected('LIMIT'));
});
test('LNW: a changed official XSD or its manifest cannot attest a result',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'cs-lnw-xsd-'));
  try {
    const worker=join(folder,'monthly-xml-worker.py'), schemas=join(folder,'pfl-schema','1.2.0');
    await cp(new URL('../../services/gkv/monthly-xml-worker.py',import.meta.url),worker);
    await mkdir(join(folder,'pfl-schema'));
    await cp(new URL('../../services/gkv/pfl-schema/1.2.0/',import.meta.url),schemas,{recursive:true});
    const run=()=>new Promise((resolve,reject)=>{
      const child=spawn('python3',['-I','-B',worker],{stdio:['pipe','pipe','pipe']}), chunks=[];
      child.on('error',reject);child.stdout.on('data',b=>chunks.push(b));child.stderr.resume();
      child.on('close',code=>code===0?resolve(JSON.parse(Buffer.concat(chunks))):reject(Error('worker exited')));child.stdin.end(generated.bytes);
    });
    assert.equal((await run()).sha256,sha(generated.bytes));
    const xsd=join(schemas,'PFL_LNW_2.2.0.xsd'), original=await readFile(xsd);
    await writeFile(xsd,Buffer.concat([original,Buffer.from('\n')]));
    assert.deepEqual(await run(),{error:'MONTHLY_XML_SCHEMA_INTEGRITY'});
    await writeFile(xsd,original);await writeFile(join(schemas,'manifest.json'),'{}');
    assert.deepEqual(await run(),{error:'MONTHLY_XML_SCHEMA_INTEGRITY'});
  }finally{await rm(folder,{recursive:true,force:true});}
});
