import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = stripTypeScriptTypes(read('src/lib/modules/constants.ts').replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
for (const os of ['web', 'android']) for (const consultation of [false, true]) {
  test(`Pflege stays locked on ${os}, consultation=${consultation}`, () => {
    const gate = new Function('Platform', 'isConsultationWorkspaceEnabled', `${source};return {isUnreleasedModuleKey,getUnreleasedModuleKeyFromPath};`)({ OS: os }, () => consultation);
    assert.equal(gate.isUnreleasedModuleKey('pflege'), true);
    for (const path of ['/pflege', '/pflege/', '/pflege/klienten', '/pflege/klienten/123?edit=1#details']) assert.equal(gate.getUnreleasedModuleKeyFromPath(path), 'pflege');
    assert.equal(gate.getUnreleasedModuleKeyFromPath('/business/office/clients'), null);
  });
}
test('Office platform override delegates to the existing shared Office hook', () => {
  const code = read('src/hooks/useClientIntakeWizard.web.ts');
  assert.match(code, /export \{ useClientIntakeWizard \} from '\.\/useClientIntakeWizard\.ts'/);
  assert.doesNotMatch(code, /careRuntime|ClientIntakeWorkflow|supabase\.web/);
  assert.match(read('src/hooks/pflege/useCareClientIntakeWizard.web.ts'), /export function useClientIntakeWizard/);
  assert.match(read('src/hooks/useClientIntakeWizard.ts'), /completeSectionFlow/);
});
