import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

// Execute the actual route/module policy. Only framework and consultation-feature
// imports are injected, so Node can exercise Web/native boundaries without React.
const source=readFileSync(new URL('../../src/lib/modules/constants.ts',import.meta.url),'utf8');
async function policy(os,consultationReleased){
 const platform='data:text/javascript;base64,'+Buffer.from(`export const Platform={OS:${JSON.stringify(os)}};`).toString('base64');
 const consultation='data:text/javascript;base64,'+Buffer.from(`export const isConsultationWorkspaceEnabled=()=>${JSON.stringify(consultationReleased)};`).toString('base64');
 const module=stripTypeScriptTypes(source,{mode:'strip'})
  .replace("from 'react-native'",`from '${platform}'`)
  .replace("from '@/lib/beratung/workspaceRelease'",`from '${consultation}'`);
 return import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
}
for(const os of ['web','android'])for(const consultationReleased of [false,true]){
 test(`Pflege bleibt auf ${os} bei Beratungsfreigabe ${consultationReleased} gesperrt`,async()=>{
  const m=await policy(os,consultationReleased);
  for(const key of ['pflege','stationaer']){
   assert.equal(m.isUnreleasedModuleKey(key),true);
   assert.equal(m.isUnreleasedCatalogModuleKey(key),true);
   for(const route of [`/${key}`,`/${key}/`,`/${key}/medikation/akte-17?revision=9#original`,`/${key.toUpperCase()}/MEDIKATION`]){
    assert.equal(m.getUnreleasedModuleKeyFromPath(route),key,route);
    assert.equal(m.isUnreleasedModuleRoute(route),true,route);
   }
  }
  for(const key of ['office','assist']){
   assert.equal(m.isUnreleasedModuleKey(key),false);
   assert.equal(m.getUnreleasedModuleKeyFromPath(`/${key}/klienten?from=pflege`),null);
  }
 });
}
test('Freigegebener Academy-Webarbeitsplatz bleibt erreichbar, unbekannte Fachrouten bleiben geschützt',async()=>{
 const m=await policy('web',false);
 assert.equal(m.isUnreleasedModuleKey('akademie'),false);
 for(const route of ['/akademie','/akademie/courses','/akademie/kurse/kurs-17'])assert.equal(m.getUnreleasedModuleKeyFromPath(route),null,route);
 assert.equal(m.getUnreleasedModuleKeyFromPath('/akademie/unbekannt'),'akademie');
 assert.equal(m.isUnreleasedCatalogModuleKey('akademie'),true);
});
test('Webfreigaben öffnen auf Android weder Academy- noch Beratungsrouten',async()=>{
 const m=await policy('android',true);
 for(const key of ['akademie','beratung']){
  assert.equal(m.isUnreleasedModuleKey(key),true);
  assert.equal(m.getUnreleasedModuleKeyFromPath(`/${key}`),key);
 }
});
test('Beratungs-Webfreigabe bleibt auf die vorgesehenen Arbeitsplatzrouten begrenzt',async()=>{
 const m=await policy('web',true);
 for(const route of ['/beratung','/beratung/arbeitsplatz','/beratung/arbeitsplatz/fall-17'])assert.equal(m.getUnreleasedModuleKeyFromPath(route),null,route);
 assert.equal(m.getUnreleasedModuleKeyFromPath('/beratung/legacy'),'beratung');
 assert.equal(m.isUnreleasedModuleKey('pflege'),true);
});
test('Pflegespezifische Routensperre erfasst keine bloß ähnlich benannten Routen',async()=>{
 const m=await policy('web',false);
 for(const route of ['/pflegebericht','/office/klienten/pflege','/assist?next=/pflege'])assert.equal(m.getUnreleasedModuleKeyFromPath(route),null,route);
});
