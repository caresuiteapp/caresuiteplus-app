import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { HelpCenterView } from '@/components/help/HelpCenterView.web';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
import type { HelpState } from '@/features/help/helpTypes';

const scalar = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
export function HelpCenterScreen() {
  const params = useLocalSearchParams<{ artikel?: string; thema?: string; zielgruppe?: string; q?: string }>();
  const router = useRouter();
  const close = useWebBackNavigation();
  const navigate = (state: HelpState) => router.setParams({ artikel: state.article ?? '', thema: state.category ?? '', zielgruppe: state.audience ?? '', q: state.q ?? '' });
  return <ScreenShell title="Hilfe & Anleitungen" showBack={false} contentOwnsHeader>
    <HelpCenterView state={{ article: scalar(params.artikel), category: scalar(params.thema), audience: scalar(params.zielgruppe), q: scalar(params.q) }} onNavigate={navigate} onOpenRoute={route => router.push(route as never)} onClose={close}/>
  </ScreenShell>;
}
