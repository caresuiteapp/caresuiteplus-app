import type {
  SectionCompleteness,
  TenantCenterSectionKey,
  TenantCenterSectionMeta,
  TenantCenterSnapshot,
} from '@/types/tenant/tenantCenter';

function scoreFilled(fields: Array<string | boolean | unknown[]>): SectionCompleteness {
  const filled = fields.filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    return String(value ?? '').trim().length > 0;
  }).length;
  if (filled === 0) return 'empty';
  if (filled >= Math.ceil(fields.length * 0.6)) return 'complete';
  return 'partial';
}

function moduleSummary(snapshot: TenantCenterSnapshot): string {
  const active = [
    snapshot.modules.assistEnabled ? 'Assist' : null,
    snapshot.modules.pflegeEnabled ? 'Pflege' : null,
    snapshot.modules.stationaerEnabled ? 'Stationär' : null,
    snapshot.modules.beratungEnabled ? 'Beratung' : null,
  ].filter(Boolean);
  return active.length ? active.join(', ') : 'Keine Module aktiv';
}

export function buildTenantCenterSections(snapshot: TenantCenterSnapshot): TenantCenterSectionMeta[] {
  const c = snapshot.company;
  const companySummary = [c.name, c.city].filter(Boolean).join(' · ') || 'Noch nicht gepflegt';
  const legalSummary = snapshot.legal.liabilityInsurer || snapshot.legal.liabilityInsurance || 'Noch nicht gepflegt';
  const taxSummary = snapshot.tax.vatId || snapshot.tax.taxNumber || 'Noch nicht gepflegt';
  const registerSummary = snapshot.register.registerNumber || snapshot.register.ikNumber || 'Noch nicht gepflegt';
  const contactSummary = snapshot.contact.supportEmail || snapshot.contact.supportPhone || 'Noch nicht gepflegt';
  const repSummary = snapshot.representatives.length
    ? `${snapshot.representatives[0]?.firstName} ${snapshot.representatives[0]?.lastName}`.trim()
    : 'Noch nicht gepflegt';
  const bankSummary = snapshot.bankAccounts.length
    ? snapshot.bankAccounts[0]?.iban?.slice(-4).padStart(snapshot.bankAccounts[0].iban.length, '•') ?? 'Hinterlegt'
    : 'Noch nicht gepflegt';
  const paymentSummary = snapshot.payment.paymentTermsDays
    ? `${snapshot.payment.paymentTermsDays} Tage Zahlungsziel`
    : 'Noch nicht gepflegt';
  const brandingSummary = snapshot.branding.logoUrl ? 'Logo hinterlegt' : 'Kein Logo';
  const customSummary = snapshot.customFields.length
    ? `${snapshot.customFields.length} Feld(er)`
    : 'Keine individuellen Felder';
  const auditSummary = snapshot.auditLogs.length
    ? `${snapshot.auditLogs.length} Einträge`
    : 'Keine Einträge';

  const sections: TenantCenterSectionMeta[] = [
    {
      key: 'company',
      title: 'Unternehmensdaten',
      description: 'Firmenname, Adresse und Branche',
      completeness: scoreFilled([c.name, c.street, c.zip, c.city, c.phone, c.email]),
      summary: companySummary,
      editable: true,
    },
    {
      key: 'legal',
      title: 'Rechtliche Angaben',
      description: 'Haftpflicht, Kammer und Berufsverbände',
      completeness: scoreFilled([
        snapshot.legal.liabilityInsurance,
        snapshot.legal.liabilityInsurer,
        snapshot.legal.professionalAssociation,
      ]),
      summary: legalSummary,
      editable: true,
    },
    {
      key: 'tax',
      title: 'Steuerdaten',
      description: 'Steuernummer, USt-IdNr. und Finanzamt',
      completeness: scoreFilled([snapshot.tax.taxNumber, snapshot.tax.vatId, snapshot.tax.taxOffice]),
      summary: taxSummary,
      editable: true,
    },
    {
      key: 'register',
      title: 'Registerdaten',
      description: 'Handelsregister, IK-Nummer und Aufsicht',
      completeness: scoreFilled([
        snapshot.register.registerCourt,
        snapshot.register.registerNumber,
        snapshot.register.ikNumber,
      ]),
      summary: registerSummary,
      editable: true,
    },
    {
      key: 'contact',
      title: 'Kontakt & Kommunikation',
      description: 'Support, Abrechnung und Ansprechpartner',
      completeness: scoreFilled([
        snapshot.contact.supportEmail,
        snapshot.contact.supportPhone,
        snapshot.contact.contactPersons,
      ]),
      summary: contactSummary,
      editable: true,
    },
    {
      key: 'representatives',
      title: 'Geschäftsführung / Vertretung',
      description: 'Vertretungsberechtigte Personen',
      completeness: snapshot.representatives.length ? 'complete' : 'empty',
      summary: repSummary,
      editable: true,
    },
    {
      key: 'bank',
      title: 'Bankverbindungen',
      description: 'Konten für Rechnungen und SEPA',
      completeness: snapshot.bankAccounts.length ? 'complete' : 'empty',
      summary: bankSummary,
      editable: true,
    },
    {
      key: 'payment',
      title: 'Zahlungsbedingungen & Mahnwesen',
      description: 'Zahlungsziel, Mahnung und Rechnungstexte',
      completeness: scoreFilled([
        snapshot.payment.paymentTermsDays,
        snapshot.payment.invoicePrefix,
        snapshot.payment.invoiceFooterText,
      ]),
      summary: paymentSummary,
      editable: true,
    },
    {
      key: 'branding',
      title: 'Logo',
      description: 'Firmenlogo hochladen',
      completeness: snapshot.branding.logoUrl ? 'complete' : 'partial',
      summary: brandingSummary,
      editable: true,
    },
    {
      key: 'modules',
      title: 'Module & Leistungsbereiche',
      description: 'Assist, Pflege, Stationär, Beratung',
      completeness: scoreFilled([
        snapshot.modules.assistEnabled,
        snapshot.modules.pflegeEnabled,
        snapshot.modules.stationaerEnabled,
        snapshot.modules.beratungEnabled,
      ]),
      summary: moduleSummary(snapshot),
      editable: true,
    },
    {
      key: 'catalog',
      title: 'Preis- und Leistungskatalog',
      description: 'Leistungen, Fahrkosten und Zuschläge',
      completeness: snapshot.catalogItems.length ? 'complete' : 'empty',
      summary: snapshot.catalogSummary || 'Noch kein Katalog',
      editable: true,
    },
    {
      key: 'customFields',
      title: 'Individuelle Felder & Funktionen',
      description: 'Eigene Felder für Dokumente und Prozesse',
      completeness: snapshot.customFields.length ? 'complete' : 'empty',
      summary: customSummary,
      editable: true,
    },
    {
      key: 'dataManagement',
      title: 'Datenimport & Datenexport',
      description: 'CSV Import/Export für Klient:innen und Mitarbeiter:innen',
      completeness: 'partial',
      summary: 'CSV Import / Export',
      editable: true,
    },
    {
      key: 'clientServiceTypes',
      title: 'Klient:innen-Leistungsarten',
      description: '6 Leistungsarten als Mandanten-Vorlagen (Alltagsbegleitung bis Beratung)',
      completeness: 'partial',
      summary: 'Leistungsarten-Vorlagen für Klient:innen',
      editable: true,
    },
    {
      key: 'clientBudgetDefaults',
      title: 'Klient:innen-Budget-Vorlagen',
      description: 'Budgetjahre und Entlastungsbudget-Vorgaben (editierbar, nicht im UI hardcodiert)',
      completeness: 'partial',
      summary: 'Budget-Vorlagen und Entlastungsbudget',
      editable: true,
    },
    {
      key: 'audit',
      title: 'Audit-Log / Änderungshistorie',
      description: 'Nachvollziehbare Änderungen am Mandanten',
      completeness: snapshot.auditLogs.length ? 'complete' : 'partial',
      summary: auditSummary,
      editable: false,
    },
    {
      key: 'supervisory',
      title: 'Aufsichtsbehörden',
      description: 'Zuständige Aufsichtsbehörden',
      completeness: snapshot.register.supervisoryAuthority ? 'partial' : 'empty',
      summary: snapshot.register.supervisoryAuthority || 'Im Registerbereich pflegen',
      editable: false,
      stub: true,
    },
    {
      key: 'locations',
      title: 'Standorte',
      description: 'Filialen und Einsatzstandorte',
      completeness: 'empty',
      summary: 'Demnächst verfügbar',
      editable: false,
      stub: true,
    },
    {
      key: 'documentLayout',
      title: 'Dokumenten-Layout',
      description: 'Briefkopf und PDF-Vorlagen',
      completeness: 'empty',
      summary: 'Demnächst verfügbar',
      editable: false,
      stub: true,
    },
    {
      key: 'ikNumbers',
      title: 'IK-Nummern',
      description: 'Institutionskennzeichen pro Bereich',
      completeness: snapshot.register.ikNumber ? 'partial' : 'empty',
      summary: snapshot.register.ikNumber || 'Im Registerbereich pflegen',
      editable: false,
      stub: true,
    },
    {
      key: 'travelSurcharges',
      title: 'Fahrkosten / Zuschläge',
      description: 'Im Leistungskatalog unter Reise/Zuschlag',
      completeness: snapshot.catalogItems.some((i) => i.category !== 'service') ? 'partial' : 'empty',
      summary: 'Im Katalog bearbeiten',
      editable: false,
      stub: true,
    },
  ];

  return sections;
}

export function getSectionByKey(
  sections: TenantCenterSectionMeta[],
  key: TenantCenterSectionKey,
): TenantCenterSectionMeta | undefined {
  return sections.find((section) => section.key === key);
}
