import { getServiceMode } from '@/lib/services/mode';
import type {
  DocumentContext,
  DocumentContextLoadResult,
  DocumentContextSection,
  DocumentEntityType,
} from './types';

function emptySection(): DocumentContextSection {
  return {};
}

export function createEmptyDocumentContext(input: {
  tenantId: string;
  entityType: DocumentEntityType;
  entityId: string;
}): DocumentContext {
  return {
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    company: emptySection(),
    client: emptySection(),
    representative: emptySection(),
    cost_carrier: emptySection(),
    recipient: emptySection(),
    invoice: emptySection(),
    visit: emptySection(),
    employee: emptySection(),
    contract: emptySection(),
    signature: emptySection(),
    document: emptySection(),
    page: { number: '1', total: '1' },
  };
}

/** Demo-Kontext nur für Demo-Modus — niemals im Live/Supabase-Modus. */
function buildDemoDocumentContext(
  entityType: DocumentEntityType,
  entityId: string,
  tenantId: string,
): DocumentContext {
  const base = createEmptyDocumentContext({ tenantId, entityType, entityId });

  return {
    ...base,
    company: {
      name: 'CareSuite Demo Pflegedienst GmbH',
      legal_name: 'CareSuite Demo Pflegedienst GmbH',
      street: 'Musterstraße 1',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 123456',
      email: 'info@demo-pflege.de',
      tax_id: '27/123/45678',
      bank_name: 'Sparkasse Berlin',
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    },
    client: {
      customer_number: 'K-10042',
      full_name: 'Helga Schneider',
      salutation: 'Frau',
      birth_date: '15.03.1948',
      street: 'Beispielweg 5',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 987654',
      care_level: 'PG 2',
    },
    recipient: {
      full_name: 'Helga Schneider',
      address: 'Beispielweg 5, 10115 Berlin',
    },
    invoice: {
      number: 'RE-DEMO-0001',
      date: '2026-06-15',
      due_date: '2026-06-29',
      service_period: '01.06.–15.06.2026',
      net_total: '323,11',
      tax_total: '61,39',
      gross_total: '384,50',
      payment_reference: 'RE-DEMO-0001',
      tax_notice: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
      line_items: '[{"description":"Grundpflege","amount":"384,50"}]',
    },
    visit: {
      date: '2026-06-15',
      start_time: '09:00',
      end_time: '10:30',
      duration: '90 Min.',
      duration_minutes: '90',
      service_type: 'Grundpflege',
      employee_name: 'Anna Pflege',
      documentation: 'Grundpflege durchgeführt, Klient:in wach und orientiert.',
      budget_reference: 'SGB XI — Entlastungsleistung',
    },
    employee: {
      full_name: 'Anna Pflege',
      first_name: 'Anna',
      last_name: 'Pflege',
      personnel_number: 'MA-0042',
      role: 'Pflegefachkraft',
      handzeichen: 'AP',
    },
    contract: {
      number: 'V-DEMO-001',
      date: '2026-01-01',
      party_a: 'CareSuite Demo Pflegedienst GmbH',
      party_b: 'Helga Schneider',
      start_date: '2026-01-01',
      end_date: '31.12.2026',
      hourly_rate: '38,00',
      notice_period: '4 Wochen zum Monatsende',
      service_description: 'Ambulante Pflege nach vereinbarter Leistung',
      privacy_clause: 'Verarbeitung personenbezogener Daten gemäß DSGVO.',
    },
    signature: {
      name: 'Helga Schneider',
      date: '2026-06-15',
      time: '10:35',
      device: 'CareSuite App',
    },
    document: {
      title: 'Pflegedokumentation',
      content: 'Klient:in wirkte wach und orientiert. Körperpflege durchgeführt.',
      created_at: '2026-06-15 10:00',
      created_by: 'Anna Pflege',
      version: '1',
    },
    page: { number: '1', total: '1' },
  };
}

export type DocumentContextRepository = {
  loadContext: (
    tenantId: string,
    entityType: DocumentEntityType,
    entityId: string,
  ) => Promise<DocumentContextLoadResult>;
};

/** Repository-Schnittstelle — Live-Implementierung folgt separat. */
let contextRepository: DocumentContextRepository | null = null;

export function registerDocumentContextRepository(repository: DocumentContextRepository): void {
  contextRepository = repository;
}

export function resetDocumentContextRepository(): void {
  contextRepository = null;
}

/**
 * Baut den Dokument-Context für Template-Rendering.
 * Demo-Fallback nur im Demo-Modus — Production/Supabase ohne Repository schlägt fehl.
 */
export async function buildDocumentContext(
  entityType: DocumentEntityType,
  entityId: string,
  tenantId: string,
): Promise<DocumentContextLoadResult> {
  if (!tenantId?.trim()) {
    return { ok: false, error: 'Mandant fehlt — Dokument-Context kann nicht geladen werden.' };
  }
  if (!entityId?.trim()) {
    return { ok: false, error: 'Entität fehlt — Dokument-Context kann nicht geladen werden.' };
  }

  if (contextRepository) {
    return contextRepository.loadContext(tenantId, entityType, entityId);
  }

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'Dokument-Context-Repository ist im Live-Modus noch nicht konfiguriert — kein Demo-Fallback.',
    };
  }

  return {
    ok: true,
    context: buildDemoDocumentContext(entityType, entityId, tenantId),
    source: 'demo',
  };
}
