import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nativePortalAuditDeviceBindings as bindings} from './native-portal-audit-device-bindings.mjs';

const load=async name=>import('data:text/javascript;base64,'+Buffer.from(bindings[name]).toString('base64'));
test('task definitions are local and never execute or register a device task',async()=>{
  const tasks=await load('expo-task-manager');let executed=false;
  tasks.defineTask('audit-task',()=>{executed=true});
  assert.equal(tasks.isTaskDefined('audit-task'),true);assert.equal(executed,false);
  await assert.rejects(tasks.isTaskRegisteredAsync('audit-task'),/device boundary/);
});
for(const [name,method]of [
  ['expo-location','getCurrentPositionAsync'],['expo-location','startLocationUpdatesAsync'],
  ['expo-document-picker','getDocumentAsync'],['expo-image-picker','launchCameraAsync'],
  ['expo-local-authentication','authenticateAsync'],['expo-notifications','getExpoPushTokenAsync'],
  ['expo-notifications','scheduleNotificationAsync'],['expo-background-task','registerTaskAsync'],
  ['expo-clipboard','getStringAsync'],['expo-sqlite','openDatabaseAsync'],
])test(name+'.'+method+' refuses an active device operation and records the boundary',async()=>{
  const module=await load(name);const before=globalThis.__nativePortalAuditEvents?.length??0;
  await assert.rejects(module[method](),/device boundary/);
  const events=globalThis.__nativePortalAuditEvents.slice(before);
  assert.equal(events.length,1);assert.equal(events[0].type,'blocked-device-boundary');
  assert.equal(typeof events[0].operation,'string');
});
test('visual journal storage is isolated per namespace and supports the real synchronous adapter',async()=>{
  const {SQLiteStorage}=await load('expo-sqlite/kv-store');
  const first=new SQLiteStorage('first'),second=new SQLiteStorage('second');
  first.setItemSync('draft','synthetic');assert.equal(first.getItemSync('draft'),'synthetic');
  assert.equal(new SQLiteStorage('first').getItemSync('draft'),'synthetic');
  assert.equal(second.getItemSync('draft'),null);assert.equal(first.getLengthSync(),1);
  first.removeItemSync('draft');assert.equal(first.getLengthSync(),0);
});
test('cryptographic data processing uses WebCrypto rather than a made-up hash',async()=>{
  const crypto=await load('expo-crypto');
  const hash=await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256,new TextEncoder().encode('abc'));
  assert.equal(Buffer.from(hash).toString('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
