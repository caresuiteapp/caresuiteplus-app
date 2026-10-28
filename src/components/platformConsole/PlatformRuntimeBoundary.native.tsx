// Generated native presentation from src/components/platformConsole/PlatformRuntimeBoundary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStrong,NativeP,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { AppState, Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { getPlatformRuntimeServerSnapshot, getPlatformRuntimeSnapshot, refreshPlatformRuntime, subscribePlatformRuntime } from "../../lib/platformConsole/platformRuntime.native.ts";
import { PLATFORM_RUNTIME_WEB_RELEASE, platformRuntimeBlock } from '@/lib/platformConsole/platformRuntimePolicy';
export function usePlatformRuntime() { useEffect(() => { void refreshPlatformRuntime(); }, []); return useSyncExternalStore(subscribePlatformRuntime, getPlatformRuntimeSnapshot, getPlatformRuntimeServerSnapshot); }
export function PlatformRuntimeBoundary({ children }: {
    children: ReactNode;
}) {
    const pathname = usePathname(), snapshot = usePlatformRuntime(), block = platformRuntimeBlock(pathname, snapshot), router = useRouter();
    useEffect(() => { const check = () => { if (AppState.currentState === 'active')
        void refreshPlatformRuntime(); }; check(); const timer = setInterval(check, 30000); const listener = AppState.addEventListener('change', state => { if (state === 'active')
        check(); }); return () => { clearInterval(timer); listener.remove(); }; }, []);
    const title = block === 'checking' ? 'Verfügbarkeit wird geprüft' : block === 'maintenance' ? 'CareSuite wird gerade gewartet' : block === 'registration' ? 'Firmenregistrierung derzeit pausiert' : 'Registrierung vorübergehend nicht verfügbar';
    const message = block === 'checking' ? 'Einen Moment bitte. Der aktuelle Betriebsstatus wird geladen.' : block === 'maintenance' ? 'CareSuite steht vorübergehend nicht zur Verfügung. Ihre Anmeldung bleibt erhalten. Nach der Freigabe können Sie hier weiterarbeiten.' : block === 'registration' ? 'Neue Unternehmen können sich aktuell nicht registrieren. Bereits registrierte Unternehmen können CareSuite weiterhin nutzen.' : 'Die Registrierungsfreigabe konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.';
    return <View style={{ flex: 1, minHeight: 0 }}>
        {snapshot.settings?.notice && !block ? <View accessibilityLiveRegion="polite" style={{ padding: 16, backgroundColor: '#eaf4ff' }}><Text style={{ color: '#12385b' }}>{snapshot.settings.notice}</Text></View> : null}
        <View style={{ flex: 1, minHeight: 0 }} accessibilityElementsHidden={Boolean(block)} importantForAccessibility={block ? 'no-hide-descendants' : 'auto'} pointerEvents={block ? 'none' : 'auto'}>{children}</View>
        <Modal visible={Boolean(block)} onRequestClose={() => { }} transparent animationType="fade"><View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#06172bf5' }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24, gap: 20, borderWidth: 1, borderColor: '#4f7aa0', borderRadius: 24, backgroundColor: '#0c2640' }}>
          <Text accessibilityRole="header" style={{ color: '#eef8ff', fontSize: 24, fontWeight: '700' }}>CareSuite HealthOS</Text><Text accessibilityRole="header" style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{title}</Text><Text style={{ color: '#eef8ff', fontSize: 16, lineHeight: 25 }}>{message}</Text>
          {snapshot.settings?.notice ? <Text style={{ color: '#eef8ff' }}>{snapshot.settings.notice}</Text> : null}
          {block !== 'checking' ? <View style={{ gap: 12 }}>{[['Erneut prüfen', () => void refreshPlatformRuntime()], ['Hilfe und Kontakt', () => router.push('/support' as never)], ['Datenschutz', () => router.push('/datenschutz' as never)], [block === 'maintenance' ? 'Plattformverwaltung' : 'Zur Anmeldung', () => router.push((block === 'maintenance' ? '/platform/login' : '/auth') as never)]].map(([label, action]) => <Pressable key={String(label)} accessibilityRole="button" onPress={action as () => void} style={{ padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#729aba', borderRadius: 14, backgroundColor: '#123955' }}><Text style={{ color: '#fff', fontSize: 16 }}>{String(label)}</Text></Pressable>)}</View> : null}
        </View></ScrollView></View></Modal>
      </View>;
}
export function PlatformRuntimeStatus() {
    const snapshot = usePlatformRuntime();
    return <NativeDiv className={`cs-notice${snapshot.status === 'failed' ? ' error' : ''}`} role="status">
    {snapshot.settings ? <>
      <NativeStrong>Aktueller Betriebsstatus: </NativeStrong>Wartung {snapshot.settings.maintenanceMode ? 'eingeschaltet' : 'ausgeschaltet'} · Firmenregistrierung {snapshot.settings.registrationEnabled ? 'freigegeben' : 'pausiert'} · Plattformhinweis {snapshot.settings.notice ? 'eingeblendet' : 'ausgeblendet'}.
      <NativeP>Geöffnete Seiten der Website und Websoftware prüfen Änderungen alle 30 Sekunden. Die Plattformverwaltung, Hilfe und rechtliche Informationen bleiben bei Wartung erreichbar.</NativeP>
      {snapshot.status === 'failed' ? <NativeP>Die letzte erneute Abfrage ist fehlgeschlagen. Angezeigt wird der zuletzt bestätigte Betriebsstatus.</NativeP> : null}
    </> : snapshot.status === 'checking' ? 'Die Anbindung der Betriebseinstellungen wird geprüft.' : 'Die Anbindung der Betriebseinstellungen konnte nicht bestätigt werden.'}
    <NativeButton className="cs-link" onClick={() => void refreshPlatformRuntime()}>Erneut prüfen</NativeButton>
  </NativeDiv>;
}
const RUNTIME_STYLE = `
.cs-runtime-root{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;height:100%;width:100%}
.cs-runtime-content{display:flex;flex-direction:column;flex:1;min-height:0}
.cs-runtime-notice{box-sizing:border-box;max-height:min(28vh,240px);overflow:auto;flex-shrink:0;display:flex;gap:12px;align-items:flex-start;background:#eaf4ff;color:#12385b;border-bottom:1px solid #b6d7f7;padding:12px clamp(16px,3vw,36px);line-height:1.5;font-family:CenturyGothic,Arial,sans-serif;overflow-wrap:anywhere}
.cs-runtime-notice strong{flex-shrink:0}.cs-runtime-notice span,.cs-runtime-card-notice{white-space:pre-wrap;overflow-wrap:anywhere}
.cs-runtime-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;align-items:safe center;overflow:auto;padding:clamp(16px,4vw,48px);background:radial-gradient(ellipse at 30% 0,#164c78,#06172b 65%);color:#eef8ff;font-family:CenturyGothic,Arial,sans-serif;line-height:1.65;box-sizing:border-box}
.cs-runtime-card{box-sizing:border-box;width:min(100%,680px);padding:clamp(24px,4vw,44px);border:1px solid #4f7aa0;border-radius:30px;background:#0c2640;box-shadow:0 20px 80px #0005;overflow-wrap:anywhere}
.cs-runtime-logo{display:block;width:min(100%,320px);height:auto;margin:0 0 32px}.cs-runtime-eyebrow{color:#a7dcff;font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;margin:0 0 12px}
.cs-runtime-card h1{font-size:clamp(1.65rem,4vw,2.4rem);line-height:1.2;margin:0 0 20px;color:#fff}.cs-runtime-card p{margin:0 0 20px}.cs-runtime-card-notice{padding:16px 20px;border-radius:18px;border:1px solid #456b8c;background:#133650}
.cs-runtime-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.cs-runtime-actions a,.cs-runtime-actions button{box-sizing:border-box;display:inline-flex;justify-content:center;align-items:center;min-height:48px;border:1px solid #729aba;border-radius:14px;padding:10px 18px;background:#123955;color:#fff;font:inherit;text-decoration:none;cursor:pointer;text-align:center}
.cs-runtime-actions button{background:#086bea;border-color:#086bea}.cs-runtime-actions a:focus-visible,.cs-runtime-actions button:focus-visible{outline:3px solid #b8eaff;outline-offset:4px}
@media(max-width:560px){.cs-runtime-notice{flex-direction:column;gap:4px}.cs-runtime-card{border-radius:24px}.cs-runtime-actions{flex-direction:column}.cs-runtime-actions>*{width:100%}}
`;
