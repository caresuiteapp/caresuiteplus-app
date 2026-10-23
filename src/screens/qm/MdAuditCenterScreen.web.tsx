import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { MdAuditCenterScreen as DemoScreen } from './MdAuditCenterScreen.tsx';

export function MdAuditCenterScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="md" />;
}
