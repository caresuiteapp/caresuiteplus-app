import { Redirect } from 'expo-router';

/** Keep saved links working after removing the separate web Office overview. */
export default function OfficeDashboardRedirect() {
  return <Redirect href={'/unternehmen' as never} />;
}
