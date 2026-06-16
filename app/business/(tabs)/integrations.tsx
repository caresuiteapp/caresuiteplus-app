import { Redirect, type Href } from 'expo-router';

export default function IntegrationsTabRedirect() {
  return <Redirect href={'/business/connect' as Href} />;
}
