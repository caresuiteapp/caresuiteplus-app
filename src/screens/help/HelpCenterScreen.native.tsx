// Generated native presentation from src/screens/help/HelpCenterScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { nativeAdministrationRoute } from '@/liquid-command/navigation/nativeAdministrationModel';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.tsx';
import { HelpCenterView } from "../../components/help/HelpCenterView.native.tsx";
import { useWebBackNavigation } from "../../hooks/useWebBackNavigation.native.ts";
import type { HelpState } from '@/features/help/helpTypes';
const scalar = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
export function HelpCenterScreen() {
    const params = useLocalSearchParams<{
        artikel?: string;
        thema?: string;
        zielgruppe?: string;
        q?: string;
    }>();
    const router = useRouter();
    const close = useWebBackNavigation();
    const navigate = (state: HelpState) => router.setParams({ artikel: state.article ?? '', thema: state.category ?? '', zielgruppe: state.audience ?? '', q: state.q ?? '' });
    return <ScreenShell title="Hilfe & Anleitungen" showBack={false} scroll={false} contentOwnsHeader><NativeDiv style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
    <HelpCenterView state={{ article: scalar(params.artikel), category: scalar(params.thema), audience: scalar(params.zielgruppe), q: scalar(params.q) }} onNavigate={navigate} onOpenRoute={route => router.push(nativeAdministrationRoute(route) as never)} onClose={close}/>
  </NativeDiv></ScreenShell>;
}
