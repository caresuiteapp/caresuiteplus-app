import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { QmAuditsScreen as DemoScreen } from './QmAuditsScreen.tsx';

export function QmAuditsScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="audits" />;
}
