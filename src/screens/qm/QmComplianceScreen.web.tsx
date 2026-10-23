import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { QmComplianceScreen as DemoScreen } from './QmComplianceScreen.tsx';

export function QmComplianceScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="compliance" />;
}
