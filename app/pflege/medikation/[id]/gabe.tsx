import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MedicationAdministrationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <Redirect href={`/pflege/medikation/${id}`} />;
}
