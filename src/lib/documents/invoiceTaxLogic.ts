import type { InvoiceLineItem, InvoiceTaxMode } from '@/types/documents/invoice';
import {
  KLEINUNTERNEHMER_NOTICE,
  USTG_4_16_NOTICE,
} from '@/types/documents/invoice';

const VAT_RATE_STANDARD = 19;

export type TaxCalculationInput = {
  taxMode: InvoiceTaxMode;
  lineItems: Omit<InvoiceLineItem, 'netTotalCents' | 'taxTotalCents' | 'grossTotalCents'>[];
};

export type TaxCalculationResult = {
  lineItems: InvoiceLineItem[];
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
  taxNotice: string;
  effectiveTaxRatePercent: number;
};

export function calculateLineItemTotals(
  item: Omit<InvoiceLineItem, 'netTotalCents' | 'taxTotalCents' | 'grossTotalCents'>,
  taxMode: InvoiceTaxMode,
): Pick<InvoiceLineItem, 'netTotalCents' | 'taxTotalCents' | 'grossTotalCents' | 'taxRatePercent'> {
  const netTotalCents = Math.round(item.quantity * item.unitPriceNetCents);
  let taxRatePercent = 0;

  if (taxMode === 'standard_vat_19') {
    taxRatePercent = VAT_RATE_STANDARD;
  }

  const taxTotalCents = Math.round(netTotalCents * (taxRatePercent / 100));
  const grossTotalCents = netTotalCents + taxTotalCents;

  return { netTotalCents, taxTotalCents, grossTotalCents, taxRatePercent };
}

export function calculateInvoiceTax(input: TaxCalculationInput): TaxCalculationResult {
  const lineItems: InvoiceLineItem[] = input.lineItems.map((item) => {
    const totals = calculateLineItemTotals(item, input.taxMode);
    return { ...item, ...totals };
  });

  const netTotalCents = lineItems.reduce((s, i) => s + i.netTotalCents, 0);
  const taxTotalCents = lineItems.reduce((s, i) => s + i.taxTotalCents, 0);
  const grossTotalCents = lineItems.reduce((s, i) => s + i.grossTotalCents, 0);

  const taxNotice = getTaxNotice(input.taxMode);
  const effectiveTaxRatePercent =
    input.taxMode === 'standard_vat_19' ? VAT_RATE_STANDARD : 0;

  return {
    lineItems,
    netTotalCents,
    taxTotalCents,
    grossTotalCents,
    taxNotice,
    effectiveTaxRatePercent,
  };
}

export function getTaxNotice(taxMode: InvoiceTaxMode): string {
  switch (taxMode) {
    case 'ustg_4_16_exempt':
      return USTG_4_16_NOTICE;
    case 'kleinunternehmer_19':
      return KLEINUNTERNEHMER_NOTICE;
    case 'standard_vat_19':
      return `Es wird ${VAT_RATE_STANDARD} % Umsatzsteuer ausgewiesen.`;
    default:
      return '';
  }
}

export function validateTaxLogicConsistency(input: TaxCalculationResult, taxMode: InvoiceTaxMode): string[] {
  const errors: string[] = [];

  if (taxMode === 'ustg_4_16_exempt' || taxMode === 'kleinunternehmer_19') {
    if (input.taxTotalCents !== 0) {
      errors.push('Steuerbetrag muss bei steuerfreiem/Kleinunternehmer-Modus 0 sein.');
    }
    if (input.grossTotalCents !== input.netTotalCents) {
      errors.push('Brutto muss Netto entsprechen (keine USt).');
    }
  }

  if (taxMode === 'standard_vat_19') {
    const expectedTax = Math.round(input.netTotalCents * 0.19);
    if (Math.abs(input.taxTotalCents - expectedTax) > 1) {
      errors.push('Steuerbetrag weicht von 19 % ab.');
    }
    if (!input.taxNotice.includes('19')) {
      errors.push('Steuerhinweis für 19 % USt fehlt.');
    }
  }

  if (input.taxNotice !== getTaxNotice(taxMode)) {
    errors.push('Steuerhinweis stimmt nicht mit Steuermodus überein.');
  }

  return errors;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
