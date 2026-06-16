import type { InvoiceTaxMode } from '@/types/documents/invoice';
import { calculateInvoiceTax, validateTaxLogicConsistency } from '@/lib/documents/invoiceTaxLogic';

export function calculateCareBillingTax(
  taxMode: InvoiceTaxMode,
  netAmountCents: number,
  description: string,
) {
  const quantity = 1;
  const unitPriceNetCents = netAmountCents;

  const result = calculateInvoiceTax({
    taxMode,
    lineItems: [
      {
        id: 'care-line-1',
        description,
        quantity,
        unit: 'Pauschal',
        unitPriceNetCents,
        taxRatePercent: 0,
      },
    ],
  });

  const line = result.lineItems[0];
  return {
    netAmountCents: line.netTotalCents,
    taxAmountCents: line.taxTotalCents,
    grossAmountCents: line.grossTotalCents,
    taxRatePercent: line.taxRatePercent,
    taxNotice: result.taxNotice,
    taxConsistent: validateTaxLogicConsistency(result, taxMode).length === 0,
  };
}

export function validateCareBillingTaxMode(
  taxMode: InvoiceTaxMode,
  netAmountCents: number,
): boolean {
  const calc = calculateCareBillingTax(taxMode, netAmountCents, 'Steuerprüfung');
  return calc.taxConsistent;
}
