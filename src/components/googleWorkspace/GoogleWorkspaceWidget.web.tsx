import { usePermissions } from '@/hooks/usePermissions';
import { useGoogleWorkspace, useWorkspacePage } from '@/hooks/useGoogleWorkspace.web';
import { googleTime, serviceDefinition, type WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';

export function GoogleWorkspaceWidget({ service, preview = false, fontScale = 1 }: { fontScale?: number; service: WorkspaceService | 'overview'; preview?: boolean }) {
  const { roleKey } = usePermissions();
  const allowed = roleKey === 'business_admin' || roleKey === 'business_manager';
  const status = useGoogleWorkspace(allowed && !preview);
  const requested = service === 'overview' ? 'calendar' : service;
  const connected = status.connection?.status === 'connected';
  const page = useWorkspacePage(requested, {}, !preview && service !== 'overview' && allowed && connected && !!status.connection?.capabilities[requested], status.connection?.connectedAt ?? '');
  const def = service === 'overview' ? { glyph: 'G', color: '#81dfff', title: 'Google Workspace' } : serviceDefinition(service);
  const note = preview ? service === 'overview' ? 'Verbindung und Dienste im Überblick' : `${def.title} direkt auf Ihrem Desktop` : !allowed ? 'Für Geschäftsführung und Verwaltung' : status.loading ? 'Verbindung wird geprüft …' : status.error ? 'Verbindungsstatus nicht verfügbar · Öffnen zum Prüfen' : !connected ? 'Google-Konto verbinden →' : service !== 'overview' && !status.connection?.capabilities[requested] ? 'Google-Freigabe fehlt · Öffnen' : page.error ? 'Abruf fehlgeschlagen · Öffnen zum Wiederholen' : page.loading && !page.data ? 'Google-Daten werden geladen …' : undefined;
  return <div data-cs-google-widget={service} style={{width:'100%',height:'100%',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8,color:'#eaf6ff',background:'linear-gradient(135deg,#102b4c,#073547)',overflow:'auto',fontSize:14*fontScale}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:10,background:'#ffffff16',color:'#91e2ff',fontWeight:800}} aria-hidden="true">{def.glyph}</span><span style={{fontSize:12*fontScale,color:'#acd6ed'}}>GOOGLE WORKSPACE</span></div>
    {note ? <p style={{margin:0,fontSize:13*fontScale,lineHeight:1.45,color:'#dcecf8'}}>{note}</p> : <>
      {service === 'overview' ? <><strong style={{fontSize:14*fontScale,overflowWrap:'anywhere'}}>{status.connection?.email}</strong><span style={{fontSize:12*fontScale,color:'#a2ebd3'}}>{Object.values(status.connection?.capabilities ?? {}).filter(Boolean).length} Dienste freigegeben</span></> : page.data?.items.length ? page.data.items.slice(0,2).map(item => <div key={item.id} style={{borderTop:'1px solid #a8ddff26',paddingTop:5}}><div style={{fontSize:13*fontScale,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.unread ? '● ' : ''}{item.title}</div><div style={{fontSize:11*fontScale,color:'#b4d6e9',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.when ? googleTime(item.when) : item.subtitle}</div></div>) : <span style={{fontSize:13*fontScale}}>Keine Einträge in dieser Auswahl.</span>}
      <span style={{fontSize:10*fontScale,color:'#aacbdd',marginTop:'auto'}}>Abruf: {googleTime(service === 'overview' ? status.connection?.lastSyncAt : page.data?.fetchedAt)}</span>
    </>}
  </div>;
}
