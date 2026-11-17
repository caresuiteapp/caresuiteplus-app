import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CentralCatalogWorkspace, type CentralCatalogWorkspaceProps } from '@/components/documents/CentralCatalogWorkspace.web';
import { CENTRAL_DOCUMENT_CATALOG, filterCentralDocuments } from '@/data/seeds/documentCatalog/centralCatalog';

const props: CentralCatalogWorkspaceProps = {
  tenantId:'tenant-a',author:'Fachkraft',demo:true,definitions:CENTRAL_DOCUMENT_CATALOG,clients:[],employees:[],loadingEntities:false,
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
  it('opens a linked specialty and ignores unknown category keys',()=>{
    const html=renderToStaticMarkup(<CentralCatalogWorkspace {...props} category="abrechnung"/>);
    expect((html.match(/class="csdc-template /g)??[]).length).toBe(filterCentralDocuments({category:'abrechnung'}).length);
    expect(html).toContain('Rechnung');
    const fallback=renderToStaticMarkup(<CentralCatalogWorkspace {...props} category="unknown-category"/>);
    expect((fallback.match(/class="csdc-template /g)??[]).length).toBe(450);
  });
  it('renders the database version selected by the route and shows a retry without falling back', () => {
    const databaseEntry = { ...CENTRAL_DOCUMENT_CATALOG[0], key: 'csdc_pruefung_001', title: 'Neue Vorlagenfassung', version: 8, modules: ['neues-modul'] };
    const html = renderToStaticMarkup(<CentralCatalogWorkspace {...props} demo={false} definitions={[databaseEntry]} module="neues-modul" templateKey={databaseEntry.key} />);
    expect(html).toContain('Neue Vorlagenfassung');
    expect(html).toContain('Entwurf · v8');
    expect((html.match(/class="csdc-template /g) ?? [])).toHaveLength(1);
    const loading = renderToStaticMarkup(<CentralCatalogWorkspace {...props} demo={false} definitions={[]} loadingDefinitions templateKey={databaseEntry.key} />);
    expect(loading).toContain('Vorlagen werden geladen');
    expect(loading).not.toContain('Diese Vorlage ist nicht mehr');
    const failed = renderToStaticMarkup(<CentralCatalogWorkspace {...props} demo={false} definitions={[]} definitionsError="Datenbank nicht erreichbar" onRetryDefinitions={vi.fn()} templateKey={databaseEntry.key} />);
    expect(failed).toContain('Datenbank nicht erreichbar');
    expect(failed).toContain('Vorlagen erneut laden');
    expect(failed).not.toContain('Keine passende Vorlage');
    expect(failed).not.toContain('class="csdc-template ');
  });
});
