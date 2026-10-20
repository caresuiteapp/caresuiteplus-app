import {
  AccessHubBaseScreen,
  type AccessOption,
} from '@/liquid-command/screens/AccessHubBaseScreen';

const PORTAL_ACCESS_OPTIONS: AccessOption[] = [
  {
    id: 'employee',
    title: 'Mitarbeiter',
    route: '/auth/employee-login',
    image: require('../../assets/auth/access-employee.png'),
    imageAccessibilityLabel: 'CareSuite-Assistent mit Stethoskop',
  },
  {
    id: 'client',
    title: 'Klient',
    route: '/auth/client-login',
    image: require('../../assets/auth/access-client.png'),
    imageAccessibilityLabel: 'CareSuite-Assistent mit medizinischem Herz',
  },
];

export function PortalAccessHubScreen() {
  return <AccessHubBaseScreen options={PORTAL_ACCESS_OPTIONS} />;
}
