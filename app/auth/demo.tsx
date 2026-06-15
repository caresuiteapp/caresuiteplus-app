import { DemoLoginScreen } from '@/screens/DemoLoginScreen';
import { DemoModeHintScreen } from '@/screens/DemoModeHintScreen';
import { DEMO_LOGIN_ROLES } from '@/data/demo/navigation';
import { isDemoMode } from '@/lib/supabase/config';

export default function DemoAuthRoute() {
  if (isDemoMode()) {
    return (
      <DemoLoginScreen
        title="Demo-Zugang"
        subtitle="Beispieldaten — lokale Session ohne Passwort"
        roles={DEMO_LOGIN_ROLES.business}
      />
    );
  }

  return <DemoModeHintScreen />;
}
