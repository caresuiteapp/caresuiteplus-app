import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from '@/lib/platformConsole/platformCapabilities';
import { PlatformShellLayout } from '@/components/platformConsole/PlatformShellLayout.web';
import { ConsoleStyle } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { SupportWorkspace } from '@/components/support/SupportWorkspace';

export function PlatformSupportScreen() {
  const { user } = useAuth();
  const { platformUser } = usePlatformAuth();
  const { company } = useLocalSearchParams<{ company?: string }>();
  return <PlatformShellLayout scroll={false} title="Support" subtitle="Anfragen bearbeiten und Unternehmen begleiten">
    <div className="cs-console" style={{ flex: 1, minHeight: 0 }}><ConsoleStyle />
      <section className="cs-hero" style={{ padding: '18px 24px' }}><div>
        <div className="cs-eyebrow">CareSuite HealthOS · Service</div>
        <h2>Ein Vorgang. Der gesamte Verlauf.</h2>
        <p>Tickets nach Unternehmen und Status finden, Zuständigkeiten übernehmen und Antworten mit Anhängen bearbeiten. Bestätigte Datenzugriffe, Verlauf und abgeschlossene Anfragen bleiben direkt am Vorgang erreichbar.</p>
      </div></section>
      {platformRoleHasCapability(platformUser?.role, 'support.read')
        ? <SupportWorkspace key={user?.id} platformMode initialSearch={typeof company === 'string' ? company : ''} />
        : <p className="cs-notice" role="status">Ihre Rolle hat keinen Zugriff auf den Support.</p>}
    </div>
  </PlatformShellLayout>;
}
