import { Redirect } from 'expo-router';

/** Native clients continue to use the existing inventory workflow. */
export default function CompanyInventoryRoute() {
  return <Redirect href="/business/office/inventory" />;
}
