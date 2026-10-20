import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liquidWorkAreas } from '@/liquid-command/navigation/moduleCatalog';
import { inferLiquidArea } from '@/liquid-command/navigation/routeContext';
import { getLiquidPrimaryWorkflowRoute } from '@/liquid-command/navigation/workflowRoutes';

const source=(file:string)=>readFileSync(resolve(process.cwd(),file),'utf8');

describe('Pflege ORBIT Navigation Live R1',()=>{
 it('shows every delivered Pflege domain in the actual ORBIT navigation',()=>{
  const ids=liquidWorkAreas.pflege.map((area)=>area.id);
  for(const id of ['sis','measures','medication','treatment','handovers','risks','evaluations','visits','deviations','md-readiness','quality','proofs','billing','invoice-foundations','acceptance','settings'])expect(ids).toContain(id);
  expect(ids.length).toBeGreaterThanOrEqual(21);
 });
 it('maps the new live routes to their visible active tabs',()=>{
  expect(inferLiquidArea('/pflege/abweichung-workflow?id=x','pflege')).toBe('deviations');
  expect(inferLiquidArea('/pflege/md-pruefbereitschaft','pflege')).toBe('md-readiness');
  expect(inferLiquidArea('/pflege/leistungsnachweis-workflow?id=x','pflege')).toBe('proofs');
  expect(inferLiquidArea('/pflege/abrechnungsfall?id=x','pflege')).toBe('billing');
  expect(inferLiquidArea('/pflege/rechnungsgrundlage-new','pflege')).toBe('invoice-foundations');
  expect(inferLiquidArea('/pflege/gesamtabnahme','pflege')).toBe('acceptance');
 });
 it('connects visible tabs to productive primary workflows',()=>{
  expect(getLiquidPrimaryWorkflowRoute('pflege','proofs')).toBe('/pflege/leistungsnachweis-new');
  expect(getLiquidPrimaryWorkflowRoute('pflege','deviations')).toBe('/pflege/abweichung-new');
  expect(getLiquidPrimaryWorkflowRoute('pflege','acceptance')).toBe('/pflege/gesamtabnahme');
 });
 it('wraps all tabs visibly on desktop and tablet instead of hiding them off-screen',()=>{
  const shell=source('src/liquid-command/shell/LiquidCommandShell.tsx');
  expect(shell).toContain('layout.isDesktop || layout.isTablet');
  expect(shell).toContain('flexWrap: \'wrap\'');
  expect(shell).toContain('showsHorizontalScrollIndicator');
 });
});
