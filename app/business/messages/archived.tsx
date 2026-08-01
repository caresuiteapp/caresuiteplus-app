import { Redirect } from 'expo-router';

export default function ArchivedCommunicationThreadsRoute() {
  return <Redirect href="/business/messages?chatAge=old" />;
}
