import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EinsatzEditRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/assist/assignments/${id}/edit`} />;
}
