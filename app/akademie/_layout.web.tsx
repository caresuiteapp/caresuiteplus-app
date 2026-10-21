import { Stack, usePathname } from 'expo-router';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
import { LiquidCommandShell } from '@/liquid-command/shell/LiquidCommandShell';
import { describeLiquidRoute } from '@/liquid-command/navigation/routeContext';

export default function AcademyWebLayout() {
  const context = describeLiquidRoute(usePathname(), 'akademie');
  return <LiquidModuleRouteLayout>
    <LiquidCommandShell activeModule="akademie" activeArea={context.areaId}
      title="CareSuite+ Akademie" subtitle="Lernen, Schulungen und Wissensvermittlung."
      contentMode="fill" showPageHeader={false}>
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
    </LiquidCommandShell>
  </LiquidModuleRouteLayout>;
}
