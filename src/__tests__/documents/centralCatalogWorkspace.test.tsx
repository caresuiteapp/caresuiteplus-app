import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CentralCatalogWorkspace, type CentralCatalogWorkspaceProps } from '@/components/documents/CentralCatalogWorkspace.web';

const props: CentralCatalogWorkspaceProps = {
  tenantId:'tenant-a',author:'Fachkraft',demo:true,clients:[],employees:[],loadingEntities:false,
  permissions:{create:true,preview:true,export:true,save:true},records:[],loadingRecords:false,
  loadContext:vi.fn(),save:vi.fn(),download:vi.fn(),onSaved:vi.fn(),onRefresh:vi.fn(),
};
describe('central catalogue UI content (no visual layout assertion)',()=>{
  it('exposes all 450 entries through one new accessible catalogue',()=>{
    const html=renderToStaticMarkup(<CentralCatalogWorkspace {...props}/>);
    expect((html.match(/class="csdc-template /g)??[]).length).toBe(450);
    expect(html).toContain('Alle 25 Fachbereiche');
    expect(html).toContain('Original + Begleitblatt');
    expect(html).toContain('Vorlagenkatalog');
  });
  it('accepts module context and exposes entity selection without guessing a person',()=>{
    const html=renderToStaticMarkup(<CentralCatalogWorkspace {...props} module="pflege" templateKey="csdc_wunden_002"/>);
    expect(html).toContain('Wundassessment');
    expect(html).toContain('Bitte eine gespeicherte Akte wählen');
    expect(props.loadContext).not.toHaveBeenCalled();
    expect(html).not.toContain('Fassung gespeichert');
  });
});
