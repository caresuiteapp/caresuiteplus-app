import { Redirect, type Href } from 'expo-router';

export default function BusinessAdminDesignSystemRoute() {
  return <Redirect href={'/design-system' as Href} />;
}
