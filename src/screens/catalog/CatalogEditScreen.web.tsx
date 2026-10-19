import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal.web';
import { CatalogIcon, CatalogNotice, CatalogRefresh, CatalogState, CatalogWorkspace, useCatalogWorkspaceData } from '@/components/catalog/CatalogWorkspace.web';

/** The historical create route now opens the same persisted position editor as the list. */
export function CatalogEditScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const data = useCatalogWorkspaceData();
  return <ScreenShell title="Katalog bearbeiten" scroll={false} contentOwnsHeader><CatalogEdit key={`${data.scope}:${id ?? ''}`} id={id} data={data}/></ScreenShell>;
}

function CatalogEdit({ id, data }: { id?: string; data: ReturnType<typeof useCatalogWorkspaceData> }) {
  const router = useFlowRouter();
  const catalog = id ? data.snapshot?.catalogs.find(item => item.id === id) : data.snapshot?.catalogs[0];
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && catalog && data.canEdit) { started.current = true; setOpen(true); }
  }, [catalog, data.canEdit]);
  const back = () => router.replace('/office/catalogs');
  return <>
    <CatalogWorkspace title={id ? 'Katalog bearbeiten' : 'Neue Katalogposition'} subtitle="Leistungen und Preise für Ihr Unternehmen pflegen." back={back} actions={data.allowed ? <CatalogRefresh loading={data.loading} onRefresh={() => void data.refresh()}/> : null} busy={data.loading}>
      {!data.allowed ? <CatalogState kind="locked" title="Kein Zugriff auf Kataloge" message="Für diesen Bereich benötigen Sie eine Office-Freigabe und die Berechtigung, Kataloge anzusehen."/> : data.loading && !data.snapshot ? <CatalogState kind="loading" title="Katalog wird geladen" message="Die verfügbaren Positionen und Ihre Bearbeitungsrechte werden geprüft."/> : data.error && !data.snapshot ? <CatalogState kind="error" title="Katalog konnte nicht geladen werden" message={data.error} action={<button type="button" className="cw-button" onClick={() => void data.refresh()}>Erneut versuchen</button>}/> : !catalog ? <CatalogState title="Kein Katalog verfügbar" message="Der gewünschte Leistungsbereich ist nicht verfügbar oder für Ihr Unternehmen noch nicht freigegeben." action={<button type="button" className="cw-button" onClick={back}>Zur Katalogübersicht</button>}/> : !data.canEdit ? <CatalogState kind="locked" title="Katalog im Lesezugriff" message="Sie können die vorhandenen Positionen ansehen. Änderungen an Leistungen und Standardpreisen erfordern die Berechtigung zur Unternehmensverwaltung." action={<button type="button" className="cw-button" onClick={() => router.replace({ pathname: '/office/catalogs/[id]', params: { id: catalog.id } })}>Katalog ansehen</button>}/> : <>
        {data.error ? <CatalogNotice error>Die Aktualisierung ist fehlgeschlagen: {data.error}</CatalogNotice> : null}
        {saved ? <CatalogNotice>Die Position wurde gespeichert und steht im Katalog zur Verfügung.</CatalogNotice> : null}
        <section className="cw-editor-start"><span className="cw-card-symbol"><CatalogIcon/></span><h2>{catalog.name}</h2><p>{id ? 'Bearbeiten Sie bestehende Positionen oder ergänzen Sie eine neue Leistung.' : 'Neue Leistungen werden direkt im bestehenden Leistungskatalog gespeichert. Wählen Sie die passende Kategorie und hinterlegen Sie die Angaben zur Abrechnung.'}</p><ul><li>Leistungen mit Stunden-, Besuchs- oder Pauschalpreisen</li><li>Fahrtkosten je Kilometer oder als Pauschale</li><li>Zuschläge als Betrag oder Prozentsatz</li></ul><div className="cw-actions"><button className="cw-button cw-button--primary" type="button" onClick={() => setOpen(true)}><CatalogIcon kind={id ? 'edit' : 'plus'}/>{id ? 'Positionen bearbeiten' : 'Position anlegen'}</button><button className="cw-button" type="button" onClick={() => router.replace({ pathname: '/office/catalogs/[id]', params: { id: catalog.id } })}>Zum Katalog<CatalogIcon kind="arrow"/></button></div></section>
      </>}
    </CatalogWorkspace>
    {open && catalog && data.canEdit && data.tenantId ? <TenantServiceCatalogModal visible tenantId={data.tenantId} initialModuleKey={catalog.moduleKey} startCreating={!id} effectivePermissions={data.permissions} onClose={() => setOpen(false)} onSaved={() => { setSaved(true); void data.refresh(); }}/> : null}
  </>;
}
