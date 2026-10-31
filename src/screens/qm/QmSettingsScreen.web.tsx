import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from './QmPreparedFeatureScreen.web';
import { QmSettingsScreen as DemoScreen } from './QmSettingsScreen.tsx';

export function QmSettingsScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="settings" />;
}
