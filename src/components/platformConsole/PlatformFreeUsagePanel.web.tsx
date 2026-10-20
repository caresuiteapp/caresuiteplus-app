import { ConsoleStyle } from './ConsoleWorkspaceUi.web';
import { PLATFORM_FREE_USAGE, PLATFORM_FUTURE_PREMIUM, PLATFORM_FREE_POLICY_VERSION } from '@/lib/platformConsole/platformFreePolicy';

export function PlatformFreeUsagePanel() {
  return <div className="cs-console"><ConsoleStyle />
    <section className="cs-panel" aria-labelledby="platform-free-usage-title" data-product-policy={PLATFORM_FREE_POLICY_VERSION}>
      <div className="cs-panel-head"><h3 id="platform-free-usage-title">Kostenlose Nutzung</h3></div>
      <div className="cs-panel-body">
        <p>{PLATFORM_FREE_USAGE}</p>
        <dl className="cs-kv"><dt>Nutzungskosten</dt><dd>0 €</dd><dt>Verfügbarkeit</dt><dd>Alle derzeit bereitgestellten Funktionen sind kostenlos.</dd></dl>
        <p>Die Funktionsfreigaben steuern den Zugriff des Unternehmens. Die Anmeldung und Nutzung erfordern keine Tarifauswahl.</p>
        <p>{PLATFORM_FUTURE_PREMIUM}</p>
      </div>
    </section>
  </div>;
}
