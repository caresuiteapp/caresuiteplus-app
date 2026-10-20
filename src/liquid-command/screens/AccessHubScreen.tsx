import { AccessHubBaseScreen, type AccessOption } from './AccessHubBaseScreen';

const ACCESS_OPTIONS: AccessOption[] = [
  {
    id: 'employee',
    title: 'Mitarbeiter',
    route: '/auth/employee-login',
    image: require('../../../assets/auth/access-employee.png'),
    imageAccessibilityLabel: 'CareSuite-Assistent mit Stethoskop',
  },
  {
    id: 'client',
    title: 'Klient',
    route: '/auth/client-login',
    image: require('../../../assets/auth/access-client.png'),
    imageAccessibilityLabel: 'CareSuite-Assistent mit medizinischem Herz',
  },
  {
    id: 'administration',
    title: 'Verwaltung',
    route: '/auth/business-login',
    image: require('../../../assets/auth/access-administration.png'),
    imageAccessibilityLabel: 'CareSuite-Assistent mit Aktenordnern',
  },
];

export function AccessHubScreen() {
  return <AccessHubBaseScreen options={ACCESS_OPTIONS} showRegistration />;
}
