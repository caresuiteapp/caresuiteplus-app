import { WebStartChoice } from '@/components/brand/WebStartChoice.web';
import { useWebStartDestination } from '@/components/brand/WebStartDestination.web';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { LiquidCommandEntryScreen } from '@/liquid-command/screens/LiquidCommandEntryScreen';

export default function WebHomeEntry() {
  const { showChoice, enterSoftware } = useWebStartDestination();
  const introReady = useAppStartIntroReady();
  if (showChoice) return <WebStartChoice active={introReady} onSoftware={enterSoftware} />;
  return <LiquidCommandEntryScreen />;
}
