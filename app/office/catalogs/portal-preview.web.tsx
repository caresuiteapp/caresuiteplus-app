import { Redirect } from 'expo-router';

/** No catalogue portal preview is published; keep old links usable. */
export default function CatalogPortalPreviewRoute() {
  return <Redirect href="/office/catalogs" />;
}
