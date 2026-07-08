import { Redirect } from 'expo-router';

export default function PlatformRoot() {
  return <Redirect href={'/platform/dashboard' as never} />;
}
