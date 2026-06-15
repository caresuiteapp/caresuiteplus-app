import { InfoBanner } from '@/components/ui';
import { isProductActive } from '@/lib/navigation';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { ProductKey } from '@/types';
import { PRODUCT_LABELS } from '@/data/demo/products';

type InactiveModuleBannerProps = {
  productKey: ProductKey;
};

export function InactiveModuleBanner({ productKey }: InactiveModuleBannerProps) {
  const tenantId = useServiceTenantId();
  if (isProductActive(productKey, tenantId)) return null;

  return (
    <InfoBanner
      title="Modul nicht aktiv"
      message={`${PRODUCT_LABELS[productKey]} ist für diesen Mandanten derzeit nicht freigeschaltet. Sie sehen Demo-Inhalte zur Admin-Prüfung.`}
      variant="warning"
      style={{ marginBottom: 16 }}
    />
  );
}
