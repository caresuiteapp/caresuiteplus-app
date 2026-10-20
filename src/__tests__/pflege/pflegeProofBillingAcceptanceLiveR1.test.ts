import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source=(file:string)=>readFileSync(resolve(process.cwd(),file),'utf8').replace(/\r\n/g,'\n');

describe('PFLEGE TEIL 4 · LEISTUNGSNACHWEIS, ABRECHNUNG & ABNAHME LIVE R1',()=>{
 const migration=source('supabase/migrations/20260812193000_pfleger_proofs_billing_acceptance_live_r1.sql');
 const service=source('src/lib/pflege/careBillingLiveService.ts');
 it('implements the complete immutable evidence chain',()=>{
  for(const table of ['pfleger_service_proofs','pfleger_billing_cases','pfleger_invoice_foundations','pfleger_period_acceptances'])expect(migration).toContain(table);
  expect(migration).toContain('REVOKE INSERT,UPDATE,DELETE');expect(migration).toContain('care_audit_events');
 });
 it('separates SGB V, SGB XI, private and mixed funding',()=>{
  expect(migration).toContain("legal_basis IN('sgb_v','sgb_xi','private','mixed')");expect(migration).toContain("basis IN('sgb_v','mixed')");expect(migration).toContain('Verordnungsbezug');
 });
 it('enforces signature review billing release invoice foundation and acceptance',()=>{
  for(const fn of ['advance_pfleger_service_proof','release_pfleger_billing_case','create_pfleger_invoice_foundation','accept_pfleger_billing_period'])expect(migration).toContain(fn);
  expect(migration).toContain("status<>'signed'");expect(migration).toContain("trim(signature_ref)<>''");expect(migration).toContain("status='ready'");expect(migration).toContain('Gesamtabnahme blockiert');
 });
 it('uses server actor server timestamps tenant RLS and active Pflege cases',()=>{
  expect(migration).toContain('public.clinical_actor_id()');expect(migration).toContain('clock_timestamp()');expect(migration).toContain('tenant_id=public.current_tenant_id()');expect(migration).toContain('public.is_active_pfleger_client');
 });
 it('contains no demo path or automatic payer transmission',()=>{
  expect(service).toContain("getServiceMode() !== 'supabase'");expect(service).not.toContain('getDemo');expect(service).not.toContain('demoDelay');expect(migration).toContain('kein automatischer DTA-, Kassen- oder Rechnungsversand');
 });
 it('provides every productive route and navigation entry',()=>{
  for(const path of ['leistungsnachweise','leistungsnachweis-new','leistungsnachweis-workflow','abrechnung','abrechnungsfall','rechnungsgrundlagen','rechnungsgrundlage-new','gesamtabnahme'])expect(source(`app/pflege/${path}.tsx`)).toContain('Screen');
  const nav=source('src/lib/navigation/moduleNav/pflegeNav.ts');expect(nav).toContain("href: '/pflege/leistungsnachweise'");expect(nav).toContain("href: '/pflege/gesamtabnahme'");
 });
});
