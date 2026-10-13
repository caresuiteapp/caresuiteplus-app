import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { documentCatalogRoute } from '@/lib/documents/documentRecommendations';

/** All modules pass their actual context to the single Office catalogue. */
export function CentralDocumentCatalogAction(props: { module?: string; clientId?: string; employeeId?: string; templateKey?: string; disabled?: boolean }) {
  const router = useRouter();
  return <PremiumButton title="Dokument aus Katalog" disabled={props.disabled} variant="secondary" onPress={() => router.push(documentCatalogRoute(props) as never)} />;
}
