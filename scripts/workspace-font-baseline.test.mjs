import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceEffectiveScale, formatWebFontScaleLabel } from '../src/design/web/webFontScaleConfig.ts';
test('new workspace 100 percent uses former 90 percent text metrics',()=>{assert.equal(formatWebFontScaleLabel(1),'100%');assert.equal(workspaceEffectiveScale(1,true),0.9);});
test('larger workspace settings remain proportionally larger',()=>{assert.equal(workspaceEffectiveScale(1.5,true),1.35);assert.ok(workspaceEffectiveScale(1.1,true)>workspaceEffectiveScale(1,true));});
test('outside workspaces existing text scale is unchanged',()=>{assert.equal(workspaceEffectiveScale(1,false),1);assert.equal(workspaceEffectiveScale(1.25,false),1.25);});
