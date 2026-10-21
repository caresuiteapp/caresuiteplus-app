import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('generated intake verifier preserves every shared form default after branch integration', () => {
  const source = stripTypeScriptTypes(read('src/types/forms/clientIntakeForm.ts').replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
  const expected = new Function(`${source};return EMPTY_CLIENT_INTAKE_FORM;`)();
  const generated = read('supabase/functions/complete-client-intake/runtime.generated.js');
  const expression = generated.match(/var EMPTY_CLIENT_INTAKE_FORM = ([\s\S]*?\n});/);
  assert.ok(expression, 'Generated defaults must be present');
  const actual = new Function(`return (${expression[1]});`)();
  assert.deepEqual(actual, expected);
});
