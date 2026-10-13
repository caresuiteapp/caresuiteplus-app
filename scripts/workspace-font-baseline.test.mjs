import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceEffectiveScale, formatWebFontScaleLabel, normalizeDesktopFontScale } from '../src/design/web/webFontScaleConfig.ts';
test('new workspace 100 percent uses former 90 percent text metrics',()=>{assert.equal(formatWebFontScaleLabel(1),'100%');assert.equal(workspaceEffectiveScale(1,true),0.9);});
test('larger workspace settings remain proportionally larger',()=>{assert.equal(workspaceEffectiveScale(1.5,true),1.35);assert.ok(workspaceEffectiveScale(1.1,true)>workspaceEffectiveScale(1,true));});
test('outside workspaces existing text scale is unchanged',()=>{assert.equal(workspaceEffectiveScale(1,false),1);assert.equal(workspaceEffectiveScale(1.25,false),1.25);});

test("saved desktop 90 percent becomes the new 100 percent baseline", () => {
  const scale = normalizeDesktopFontScale(0.9);
  assert.equal(formatWebFontScaleLabel(scale), "100%");
  assert.equal(workspaceEffectiveScale(scale, true), 0.9);
});
test("desktop migration preserves larger accessibility settings", () => {
  for (const scale of [1, 1.1, 1.25, 1.5]) assert.equal(normalizeDesktopFontScale(scale), scale);
});
test("invalid desktop settings fall back to the baseline", () => {
  for (const value of [undefined, null, NaN, 0, 0.95, 2, "0.9"]) assert.equal(normalizeDesktopFontScale(value), 1);
});
