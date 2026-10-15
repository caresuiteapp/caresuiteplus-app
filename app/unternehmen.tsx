import { Redirect } from 'expo-router';

/** Native clients keep their existing Office entry point. */
export default function CompanyRoute() {
  return <Redirect href="/office" />;
}
