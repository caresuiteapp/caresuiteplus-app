import { Redirect, useLocalSearchParams } from 'expo-router';
import { COMPANY_INVENTORY_ROUTE, type CompanyInventoryView } from './companyInventoryRoute';

export function CompanyInventoryRedirect({ view }: { view?: CompanyInventoryView }) {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: COMPANY_INVENTORY_ROUTE, params: view ? { ...params, ansicht: view } : params } as never} />;
}
