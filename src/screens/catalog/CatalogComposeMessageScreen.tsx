import { MessageComposeScreenShell } from '@/screens/shared/MessageComposeScreenShell';

/** WP453 */
export function CatalogComposeMessageScreen() {
  return (
    <MessageComposeScreenShell
      wpNumber={453}
      domain="catalog"
      permission="office.catalogs.view"
      audienceScope="office"
    />
  );
}
