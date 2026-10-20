import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EinsatzDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/assist/assignments/${id}`} />;
}
