import { Redirect, useLocalSearchParams } from 'expo-router';

export default function BusinessMessageDetailRoute() {
  const { id, threadId, thread, ...params } = useLocalSearchParams<Record<string, string | string[]>>();
  return <Redirect href={{ pathname: '/business/messages', params: { ...params, thread: thread ?? threadId ?? id } }} />;
}
