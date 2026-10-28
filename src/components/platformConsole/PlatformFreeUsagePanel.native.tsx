// Generated native presentation from src/components/platformConsole/PlatformFreeUsagePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSection,NativeH3,NativeP,NativeDl,NativeDt,NativeDd} from '@/components/layout/NativeWorkspaceElements.native';
import { ConsoleStyle } from "./ConsoleWorkspaceUi.native.tsx";
import { PLATFORM_FREE_USAGE, PLATFORM_FUTURE_PREMIUM, PLATFORM_FREE_POLICY_VERSION } from '@/lib/platformConsole/platformFreePolicy';
export function PlatformFreeUsagePanel() {
    return <NativeDiv className="cs-console"><ConsoleStyle />
    <NativeSection className="cs-panel" aria-labelledby="platform-free-usage-title" data-product-policy={PLATFORM_FREE_POLICY_VERSION}>
      <NativeDiv className="cs-panel-head"><NativeH3 id="platform-free-usage-title">Kostenlose Nutzung</NativeH3></NativeDiv>
      <NativeDiv className="cs-panel-body">
        <NativeP>{PLATFORM_FREE_USAGE}</NativeP>
        <NativeDl className="cs-kv"><NativeDt>Nutzungskosten</NativeDt><NativeDd>0 €</NativeDd><NativeDt>Verfügbarkeit</NativeDt><NativeDd>Alle derzeit bereitgestellten Funktionen sind kostenlos.</NativeDd></NativeDl>
        <NativeP>Die Funktionsfreigaben steuern den Zugriff des Unternehmens. Die Anmeldung und Nutzung erfordern keine Tarifauswahl.</NativeP>
        <NativeP>{PLATFORM_FUTURE_PREMIUM}</NativeP>
      </NativeDiv>
    </NativeSection>
  </NativeDiv>;
}
