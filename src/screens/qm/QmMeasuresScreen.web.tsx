import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { QmMeasuresScreen as DemoScreen } from './QmMeasuresScreen.tsx';

export function QmMeasuresScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="measures" />;
}
