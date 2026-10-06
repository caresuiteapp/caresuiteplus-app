import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from '@/lib/platformConsole/platformCapabilities';
import { PlatformShellLayout } from '@/components/platformConsole/PlatformShellLayout.web';
import { ConsoleStyle } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { SupportWorkspace } from '@/components/support/SupportWorkspace.web';
import {useState} from 'react';
import {PublicSupportQueue} from '@/components/support/PublicSupportQueue.web';

export function PlatformSupportScreen() {
  const { user } = useAuth();
  const { platformUser } = usePlatformAuth();
  const { company, tenantId, ticket } = useLocalSearchParams<{ company?: string; tenantId?: string; ticket?: string }>();
  const [inbox,setInbox]=useState<'tenant'|'public'>('tenant');
  return <PlatformShellLayout scroll={false} title="Support" subtitle="Anfragen bearbeiten und Unternehmen begleiten">
    <div className="cs-console" style={{ flex: 1, minHeight: 0 }}><ConsoleStyle />
      <section className="cs-hero" style={{ padding: '18px 24px' }}><div>
        <div className="cs-eyebrow">CareSuite HealthOS · Service</div>
        <h2>Ein Vorgang. Der gesamte Verlauf.</h2>
        <p>Tickets nach Unternehmen und Status finden, Zuständigkeiten übernehmen und Antworten mit Anhängen bearbeiten. Bestätigte Datenzugriffe, Verlauf und abgeschlossene Anfragen bleiben direkt am Vorgang erreichbar.</p>
      </div></section>
      {platformRoleHasCapability(platformUser?.role, 'support.read')
        ? <><nav aria-label="Support-Eingänge" style={{display:'flex',flexWrap:'wrap',gap:12,padding:'12px 24px'}}>{[['tenant','Unternehmenstickets'],['public','Öffentliche Anfragen']].map(([key,label])=><button key={key} aria-pressed={inbox===key} onClick={()=>setInbox(key as 'tenant'|'public')} style={{padding:'12px 16px',borderRadius:12,border:'1px solid #365b84',background:inbox===key?'#126cff':'#102039',color:'#fff',cursor:'pointer'}}>{label}</button>)}</nav>{inbox==='tenant'?<SupportWorkspace key={`${user?.id}-${tenantId ?? ''}-${ticket ?? ''}`} platformMode tenantId={typeof tenantId==='string'?tenantId:undefined} initialTicket={typeof ticket==='string'?ticket:undefined} initialSearch={!tenantId && typeof company === 'string' ? company : ''} />:<PublicSupportQueue key={user?.id} canWrite={platformRoleHasCapability(platformUser?.role,'support.write')}/>}</>
        : <p className="cs-notice" role="status">Ihre Rolle hat keinen Zugriff auf den Support.</p>}
    </div>
  </PlatformShellLayout>;
}
