import { Redirect, useLocalSearchParams } from 'expo-router';

export default function OfficeMessageDetailRoute() {
  const { id, threadId, thread, ...params } = useLocalSearchParams<Record<string, string | string[]>>();
  return <Redirect href={{ pathname: '/office/messages', params: { ...params, thread: thread ?? threadId ?? id } }} />;
}
