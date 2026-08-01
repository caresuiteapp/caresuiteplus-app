import { Redirect } from 'expo-router';

export default function NewCommunicationThreadRoute() {
  return <Redirect href="/business/messages?compose=1" />;
}
