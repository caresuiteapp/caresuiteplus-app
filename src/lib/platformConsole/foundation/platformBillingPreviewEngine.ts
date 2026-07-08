import type {
  PlatformBillingPreviewInput,
  PlatformBillingPreviewResult,
  PlatformTenantDiscount,
} from '@/types/platformConsole/foundation';

function isDiscountActive(discount: PlatformTenantDiscount, at: Date): boolean {
  if (discount.status !== 'active') return false;
  if (discount.catalogStatus && discount.catalogStatus !== 'active') return false;
  if (discount.startsAt && new Date(discount.startsAt).getTime() > at.getTime()) return false;
  if (discount.endsAt && new Date(discount.endsAt).getTime() <= at.getTime()) return false;
  return true;
}

function discountAmountCents(subtotalCents: number, discount: PlatformTenantDiscount): number {
  if (discount.discountType === 'percentage' && discount.percentage != null) {
    return Math.round(subtotalCents * discount.percentage / 100);
  }
  if (discount.discountType === 'fixed_amount' && discount.amountCents != null) {
    return discount.amountCents;
  }
  return 0;
}

export function calculateBillingPreview(
  input: PlatformBillingPreviewInput,
): PlatformBillingPreviewResult {
  const at = input.at ? new Date(input.at) : new Date();
  const subtotalCents = input.pricing.subtotalCents;
  const lineItems: PlatformBillingPreviewResult['lineItems'] = [];

  if (input.pricing.planPriceCents > 0) {
    lineItems.push({
      lineType: 'plan',
      description: 'Plan',
      amountCents: input.pricing.planPriceCents,
    });
  }

  if (input.pricing.addonTotalCents > 0) {
    lineItems.push({
      lineType: 'addon',
      description: 'Add-ons',
      amountCents: input.pricing.addonTotalCents,
    });
  }

  const activeDiscounts = input.discounts.filter((d) => isDiscountActive(d, at));
  const discountCents = activeDiscounts.reduce(
    (sum, d) => sum + discountAmountCents(subtotalCents, d),
    0,
  );

  if (discountCents > 0) {
    lineItems.push({
      lineType: 'discount',
      description: 'Rabatte',
      amountCents: -discountCents,
    });
  }

  const afterDiscount = Math.max(0, subtotalCents - discountCents);
  const creditCents = Math.min(Math.max(0, input.creditBalanceCents), afterDiscount);
  if (creditCents > 0) {
    lineItems.push({
      lineType: 'credit',
      description: 'Guthaben',
      amountCents: -creditCents,
    });
  }

  const totalCents = Math.max(0, afterDiscount - creditCents);

  return {
    subtotalCents,
    discountCents,
    creditCents,
    totalCents,
    lineItems,
  };
}
