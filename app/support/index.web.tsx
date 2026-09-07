import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { LoadingState } from '@/components/ui';
import { SupportWorkspace } from '@/components/support/SupportWorkspace';

export default function SupportRoute() {
  const { authReady, isAuthenticated, user, profile } = useAuth();
  if (!authReady) return <LoadingState message="Support wird geöffnet …" />;
  if (!isAuthenticated) return <Redirect href="/auth/business-login" />;
  return <ScreenShell title="Support & Hilfe" subtitle="Chat, Tickets und bestätigte Zugriffe" scroll={false}><SupportWorkspace key={`${user?.id}:${profile?.tenantId}`} /></ScreenShell>;
}
