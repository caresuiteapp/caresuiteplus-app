import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CompanyDashboardAlias() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/office', params } as never} />;
}
