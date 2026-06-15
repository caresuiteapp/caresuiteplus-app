import { Redirect, type Href } from 'expo-router';

export default function BusinessDashboardAliasRoute() {
  return <Redirect href={'/business' as Href} />;
}
