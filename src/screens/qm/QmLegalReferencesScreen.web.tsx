import { getServiceMode } from '@/lib/services/mode';
import { QmRegisterScreen } from './QmRegisterScreen.web';
import { QmLegalReferencesScreen as DemoScreen } from './QmLegalReferencesScreen.tsx';

export function QmLegalReferencesScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmRegisterScreen kind="legal" />;
}
