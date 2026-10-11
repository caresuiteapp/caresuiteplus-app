import { useRouter } from 'expo-router';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { centralDocumentCatalogHref } from '@/data/seeds/documentCatalog/centralCatalog';

/** All modules pass their actual context to the single Office catalogue. */
export function CentralDocumentCatalogAction(props: { module?: string; clientId?: string; employeeId?: string; templateKey?: string; disabled?: boolean }) {
  const router = useRouter();
  return <PremiumButton title="Dokument aus Katalog" disabled={props.disabled} variant="secondary" onPress={() => router.push(centralDocumentCatalogHref(props) as never)} />;
}
