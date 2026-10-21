import test from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP_AREAS, desktopAreaForRoute, desktopAreaStorageKey } from '../src/liquid-command/navigation/desktopAreas.ts';
test('nine requested desktop areas with Academy directly after consultation', () => {
 assert.deepEqual(DESKTOP_AREAS.map(area => area.label), ['Office','Assist','Pflege','Stationär','Beratung','Akademie','Roboter','Premium','Einstellungen']);
});
test('each functional route belongs to exactly its desktop', () => {
 for (const [route, expected] of [['/office/clients','office'],['/business/office/clients/42','office'],['/assist/assignments','assist'],['/pflege/plans','pflege'],['/stationaer/residents','stationaer'],['/beratung/settings','beratung'],['/akademie','akademie'],['/akademie/vorlagen?view=all','akademie'],['/akademie/kurse/42#content','akademie'],['/robotics?area=devices','robotics'],['/settings/profile','settings'],['/business/subscription','premium']]) assert.equal(desktopAreaForRoute(route), expected);
});
test('shared office destinations preserve their area with query/hash', () => {
 for(const route of ['/business/messages?audience=employees','/business/connect/google-workspace#files','/business/templates/contracts']) assert.equal(desktopAreaForRoute(route),'office');
});
test('prefix collisions and unrelated routes do not enter desktops', () => {
 for(const route of ['/office-extra','/robotics-test','/settings-extra','/platform/billing','/akademie-extra']) assert.equal(desktopAreaForRoute(route),null);
});
test('storage keys isolate all areas, accounts and tenants', () => {
 const keys = DESKTOP_AREAS.flatMap(area => [['tenant-a','user-a'],['tenant-b','user-a'],['tenant-a','user-b']].map(([tenant,user]) => desktopAreaStorageKey(tenant,user,area.key)));
 assert.equal(new Set(keys).size,27);
 assert.equal(desktopAreaStorageKey('a','b','office'),desktopAreaStorageKey('a','b','office'));
 assert.notEqual(desktopAreaStorageKey('a:b','c','office'),desktopAreaStorageKey('a','b:c','office'));
});
