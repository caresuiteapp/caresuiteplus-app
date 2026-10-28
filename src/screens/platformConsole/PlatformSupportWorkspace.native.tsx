// Generated native presentation from src/screens/platformConsole/PlatformSupportWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSection,NativeH2,NativeP,NativeNav,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from "../../lib/platformConsole/platformCapabilities.native.ts";
import { PlatformShellLayout } from "../../components/platformConsole/PlatformShellLayout.native.tsx";
import { ConsoleStyle } from "../../components/platformConsole/ConsoleWorkspaceUi.native.tsx";
import { SupportWorkspace } from "../../components/support/SupportWorkspace.native.tsx";
import { useState } from 'react';
import { PublicSupportQueue } from "../../components/support/PublicSupportQueue.native.tsx";
export function PlatformSupportScreen() {
    const { user } = useAuth();
    const { platformUser } = usePlatformAuth();
    const { company, tenantId, ticket } = useLocalSearchParams<{
        company?: string;
        tenantId?: string;
        ticket?: string;
    }>();
    const [inbox, setInbox] = useState<'tenant' | 'public'>('tenant');
    return <PlatformShellLayout scroll={false} title="Support" subtitle="Anfragen bearbeiten und Unternehmen begleiten">
    <NativeDiv className="cs-console" style={{ flex: 1, minHeight: 0 }}><ConsoleStyle />
      <NativeSection className="cs-hero" style={{ padding: '18px 24px' }}><NativeDiv>
        <NativeDiv className="cs-eyebrow">CareSuite HealthOS · Service</NativeDiv>
        <NativeH2>Ein Vorgang. Der gesamte Verlauf.</NativeH2>
        <NativeP>Tickets nach Unternehmen und Status finden, Zuständigkeiten übernehmen und Antworten mit Anhängen bearbeiten. Bestätigte Datenzugriffe, Verlauf und abgeschlossene Anfragen bleiben direkt am Vorgang erreichbar.</NativeP>
      </NativeDiv></NativeSection>
      {platformRoleHasCapability(platformUser?.role, 'support.read')
            ? <><NativeNav aria-label="Support-Eingänge" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 24px' }}>{[['tenant', 'Unternehmenstickets'], ['public', 'Öffentliche Anfragen']].map(([key, label]) => <NativeButton key={key} aria-pressed={inbox === key} onClick={() => setInbox(key as 'tenant' | 'public')} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #365b84', background: inbox === key ? '#126cff' : '#102039', color: '#fff', cursor: 'pointer' }}>{label}</NativeButton>)}</NativeNav>{inbox === 'tenant' ? <SupportWorkspace key={`${user?.id}-${tenantId ?? ''}-${ticket ?? ''}`} platformMode tenantId={typeof tenantId === 'string' ? tenantId : undefined} initialTicket={typeof ticket === 'string' ? ticket : undefined} initialSearch={!tenantId && typeof company === 'string' ? company : ''}/> : <PublicSupportQueue key={user?.id} canWrite={platformRoleHasCapability(platformUser?.role, 'support.write')}/>}</>
            : <NativeP className="cs-notice" role="status">Ihre Rolle hat keinen Zugriff auf den Support.</NativeP>}
    </NativeDiv>
  </PlatformShellLayout>;
}
