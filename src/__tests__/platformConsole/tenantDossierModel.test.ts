import { describe, expect, it } from 'vitest';
import { buildTenantSetup, dossierChangedFields, dossierPersonCompleteness, safeDossierLogo, type TenantDossier } from '@/lib/platformConsole/tenantDossierModel';
export function dossierFixture(): TenantDossier {
  return {
    tenantId:'00000000-0000-4000-8000-000000000001', checkedAt:'2026-10-09T01:00:00Z',
    company:{name:'Musterunternehmen GmbH',legal_form:'GmbH',industry:'Alltagsbegleitung',street:'Testweg',postal_code:'12345',city:'Berlin',country:'DE',email:'kontakt@example.test',phone:'030123456',representative_name:'Musterperson',tax_number:'123/456/78901',register_court:'Berlin',register_number:'HRB 12345'}, platform:{status:'active'},
    branding:{logo_url:'https://example.test/logo.png'},billing:{invoice_prefix:'RE',payment_terms_days:14},bank:{iban:'DE02120300000000202051',account_holder:'Musterunternehmen GmbH'},portal:{employee_portal_enabled:true},tax:null,register:null,
    counts:{clients:{total:10,active:10,deleted:1,complete:10,portalEnabled:0,portalLinked:0},employees:{total:3,active:3,deleted:0,complete:3,portalEnabled:0,portalLinked:0},accounts:4,adminAccounts:1,loggedInAccounts:1,lastLoginAt:'2026-10-09T01:00:00Z',services:3,pricedServices:3,assignments:20,documents:30},
    sections:[{key:'tenants',label:'Unternehmensstammdaten',scope:'company',available:true,count:1,updatedAt:null},{key:'clients',label:'Klient:innen',scope:'clients',available:true,count:11,updatedAt:null},{key:'client_contacts',label:'Kontaktpersonen',scope:'clients',available:true,count:5,updatedAt:null},{key:'employees',label:'Mitarbeitende',scope:'employees',available:true,count:3,updatedAt:null}],
  };
}
describe('recorded company configuration completeness',()=>{
  it('requires every basic criterion for 100% and reflects partial person data',()=>{
    const data=dossierFixture();expect(buildTenantSetup(data).percentage).toBe(100);
    data.counts.clients.complete=5;
    const progress=buildTenantSetup(data);expect(progress.percentage).toBeLessThan(100);
    expect(progress.steps.find(step=>step.key==='clients-complete')).toMatchObject({score:0.5,state:'partial',evidence:'5 von 10 Datensätzen erfüllen die Grundprüfung.'});
  });
  it('does not treat an empty company, missing people or lifecycle live as fully set up',()=>{
    const data=dossierFixture();data.company={};data.platform={lifecycle_status:'live'};data.branding=null;data.bank=null;data.billing=null;
    data.counts.clients={total:0,active:0,deleted:0,complete:0,portalEnabled:0,portalLinked:0};data.counts.employees={...data.counts.clients};data.counts.adminAccounts=0;data.counts.loggedInAccounts=0;data.counts.lastLoginAt=null;data.counts.services=0;data.counts.pricedServices=0;
    expect(buildTenantSetup(data)).toMatchObject({percentage:0,complete:0});
  });
  it('excludes register criteria for a sole proprietor but keeps missing classification open',()=>{
    const data=dossierFixture();data.company.legal_form='Einzelunternehmen';data.company.register_court=null;data.company.register_number=null;
    expect(buildTenantSetup(data).steps.find(step=>step.key==='register')?.state).toBe('not_applicable');expect(buildTenantSetup(data).percentage).toBe(100);
    data.company.legal_form=null;expect(buildTenantSetup(data).percentage).toBeLessThan(100);
  });
  it('counts incomplete employee portal assignments only when portals have been activated',()=>{
    const data=dossierFixture();data.counts.employees.portalEnabled=3;data.counts.employees.portalLinked=1;
    expect(buildTenantSetup(data).steps.find(step=>step.key==='employee-portals')).toMatchObject({score:1/3,state:'partial'});
  });
  it('shares the same person basic criteria with the list and treats zero and false as real values',()=>{
    expect(dossierPersonCompleteness({first_name:'Anna',last_name:'Test',street:'Testweg',postal_code:'12345',city:'Berlin'},'clients').percentage).toBe(100);
    expect(dossierPersonCompleteness({first_name:'Emma',last_name:'Test',mobile:'123',employment_type:'part_time',entry_date:'2026-10-01',weekly_hours:0},'employees').percentage).toBe(100);
    expect(dossierChangedFields({portal_enabled:true},{portal_enabled:false})).toEqual([{key:'portal_enabled',before:true,after:false}]);
  });
  it('rejects executable or credential-bearing image URLs and suppresses credential diffs',()=>{
    for(const value of ['javascript:alert(1)','data:text/html,x','//example.test/logo','https://user:password@example.test/a.png','/\\example.test/a.png']) expect(safeDossierLogo(value)).toBeNull();
    expect(safeDossierLogo('/logo.png')).toBe('/logo.png');
    expect(dossierChangedFields({password:'a',email:'a'},{password:'b',email:'b'})).toEqual([{key:'email',before:'a',after:'b'}]);
  });
});
