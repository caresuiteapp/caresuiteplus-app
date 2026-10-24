import { getServiceMode } from '@/lib/services/mode';
import { QmPreparedFeatureScreen } from './QmPreparedFeatureScreen.web';
import { QmExportCenterScreen as DemoScreen } from './QmExportCenterScreen.tsx';

export function QmExportCenterScreen() {
  return getServiceMode() === 'demo' ? <DemoScreen /> : <QmPreparedFeatureScreen feature="export" />;
}
