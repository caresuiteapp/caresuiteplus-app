import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy alias → canonical execution route (keeps Assist shell). */
export default function DurchfuehrungDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/assist/assignments/${id}/execute`} />;
}
