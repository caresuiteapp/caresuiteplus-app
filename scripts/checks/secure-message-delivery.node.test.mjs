import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isMessageSecurelyRead, normalizeMessageDeliveryEvidence } from '../../src/features/communication/messageDeliveryEvidence.ts';

const sent='2026-10-14T10:00:00.000001Z',delivered='2026-10-14T10:00:01.000001Z',read='2026-10-14T10:00:02.000001Z';

test('vollständig geordnete Zustellung kann gelesen sein',()=>{
  const evidence=normalizeMessageDeliveryEvidence({status:'read',sentAt:sent,deliveredAt:delivered,readAt:read});
  assert.equal(evidence.status,'read');assert.equal(isMessageSecurelyRead(evidence),true);assert.equal(Object.isFrozen(evidence),true);
});

test('Mikrosekunden entscheiden die Reihenfolge ohne Millisekundenverlust',()=>{
  const evidence=normalizeMessageDeliveryEvidence({
    status:'read',
    sentAt:'2026-10-14T10:00:00.000003Z',
    deliveredAt:'2026-10-14T10:00:00.000002Z',
    readAt:'2026-10-14T10:00:00.000004Z',
  });
  assert.equal(evidence.status,'sent');assert.equal(evidence.readAt,null);assert.equal(evidence.consistent,false);
});

test('Bearbeitungsstatus bewahrt eine geordnete Original-Lesekette',()=>{
  const evidence=normalizeMessageDeliveryEvidence({status:'edited',sentAt:sent,deliveredAt:delivered,readAt:read});
  assert.equal(evidence.status,'edited');assert.equal(evidence.readAt,read);assert.equal(isMessageSecurelyRead(evidence),true);
});

for(const patch of [
  {sentAt:null},{deliveredAt:null},{readAt:null},{deliveredAt:read,readAt:delivered},
]) test('unvollständige oder rückläufige Lesekette wird nicht als gelesen projiziert',()=>{
  const evidence=normalizeMessageDeliveryEvidence({status:'read',sentAt:sent,deliveredAt:delivered,readAt:read,...patch});
  assert.equal(isMessageSecurelyRead(evidence),false);assert.equal(evidence.readAt,null);
});

test('fehlgeschlagene Zustellung verwirft widersprüchlichen Zustell- und Lesebeleg',()=>{
  const evidence=normalizeMessageDeliveryEvidence({status:'failed',sentAt:sent,deliveredAt:delivered,readAt:read});
  assert.deepEqual(evidence,{status:'failed',sentAt:sent,deliveredAt:null,readAt:null,consistent:false});
  assert.equal(isMessageSecurelyRead(evidence),false);
});

test('gesendet ist nicht bereits zugestellt',()=>{
  const evidence=normalizeMessageDeliveryEvidence({status:'sent',sentAt:sent,deliveredAt:delivered,readAt:read});
  assert.deepEqual(evidence,{status:'sent',sentAt:sent,deliveredAt:null,readAt:null,consistent:false});
});

test('Live-Sendedienst setzt beim Speichern keinen Zustellbeleg',async()=>{
  const source=await readFile(new URL('../../src/features/communication/communication.service.ts',import.meta.url),'utf8');
  const messageLiteral=source.slice(source.indexOf("status: 'sent'"),source.indexOf('readAt: null')+'readAt: null'.length);
  assert.match(messageLiteral,/status: 'sent'/);assert.match(messageLiteral,/deliveredAt: null/);
});

test('Live-Mapper normalisiert Status und Zeiten gemeinsam',async()=>{
  const source=await readFile(new URL('../../src/features/communication/repositories/communicationMappers.ts',import.meta.url),'utf8');
  assert.match(source,/normalizeMessageDeliveryEvidence/);assert.match(source,/status: delivery\.status/);assert.match(source,/readAt: delivery\.readAt/);
});

test('SQL verweigert Lesebeleg nach Fehlschlag und verlangt geordnete Zustellung',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014120000_secure_message_delivery_evidence.sql',import.meta.url),'utf8');
  assert.match(sql,/status <> 'failed' OR \(delivered_at IS NULL AND read_at IS NULL\)/);
  assert.match(sql,/OLD\.status = 'failed' AND NEW\.status IN \('delivered', 'read'\)/);
  assert.match(sql,/NEW\.sent_at > NEW\.delivered_at/);assert.match(sql,/NEW\.delivered_at > NEW\.read_at/);
});

test('SQL bindet Lesebestätigung an dieselbe zugestellte und gelesene Nachricht',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014120000_secure_message_delivery_evidence.sql',import.meta.url),'utf8');
  for(const condition of [/m\.id = NEW\.message_id/,/m\.thread_id = NEW\.thread_id/,/m\.tenant_id = NEW\.tenant_id/,/source_status NOT IN \('read', 'edited', 'deleted', 'archived'\)/,/NEW\.read_at < source_delivered_at/])assert.match(sql,condition);
});

test('beide Guard-Funktionen sind nicht direkt ausführbar',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014120000_secure_message_delivery_evidence.sql',import.meta.url),'utf8');
  assert.ok((sql.match(/REVOKE ALL ON FUNCTION public\.guard_communication_/g)??[]).length===2);
  assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public\.guard_communication_/);
});
