import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { QmChangesScreen as DemoScreen } from './QmChangesScreen.tsx';

export function QmChangesScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="changes" />;
}
