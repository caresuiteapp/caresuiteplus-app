import type {
  AssignmentMasterDataInput,
  BillingReadinessInput,
  ClientMasterDataInput,
  DataQualityIssue,
  DataQualityResult,
  DataQualityStatus,
  DocumentReadinessInput,
  EmployeeMasterDataInput,
  InvoiceMasterDataInput,
  MasterDataEntityType,
  PortalAccessInput,
  ServiceRecordMasterDataInput,
  TenantMasterDataInput,
} from '@/types/admin/dataQuality';

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function isValidEmail(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value!.trim());
}

function isValidIban(value: string | null | undefined): boolean {
  if (!hasText(value)) return false;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value!.replace(/\s/g, '').toUpperCase());
}

function issue(
  type: DataQualityIssue['type'],
  fieldKey: string,
  message: string,
  severity: DataQualityIssue['severity'] = 'error',
): DataQualityIssue {
  return { type, fieldKey, message, severity };
}

function deriveStatus(
  errors: DataQualityIssue[],
  warnings: DataQualityIssue[],
): DataQualityStatus {
  if (errors.some((e) => e.type === 'cross_tenant_risk')) return 'blocked';
  if (errors.length > 0) return 'incomplete';
  if (warnings.length > 0) return 'warning';
  return 'complete';
}

function buildResult(
  entityType: MasterDataEntityType,
  entityId: string,
  errors: DataQualityIssue[],
  warnings: DataQualityIssue[],
  recommendedActions: string[],
): DataQualityResult {
  const blockingIssues = errors.filter((e) => e.severity === 'error');
  const status = deriveStatus(errors, warnings);
  return {
    status,
    errors,
    warnings,
    blockingIssues,
    recommendedActions,
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    validatedAt: new Date().toISOString(),
  };
}

function assertSameTenant(
  tenantId: string,
  contextTenantId: string | null | undefined,
  entityLabel: string,
): DataQualityIssue | null {
  if (contextTenantId && contextTenantId !== tenantId) {
    return issue(
      'cross_tenant_risk',
      'tenant_id',
      `${entityLabel}: Mandanten-Kontext stimmt nicht überein — Zugriff blockiert.`,
    );
  }
  return null;
}

export function validateTenantMasterData(input: TenantMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  if (!hasText(input.name)) {
    errors.push(issue('missing_required_field', 'tenant.name', 'Firmenname fehlt.'));
    actions.push('Firmenname im Firmenprofil ergänzen.');
  }
  if (!hasText(input.legalForm)) {
    errors.push(issue('missing_required_field', 'tenant.legal_form', 'Rechtsform fehlt.'));
  }
  if (!hasText(input.street) || !hasText(input.zip) || !hasText(input.city)) {
    errors.push(issue('missing_required_field', 'tenant.address', 'Adresse unvollständig.'));
    actions.push('Vollständige Geschäftsadresse hinterlegen.');
  }
  if (!hasText(input.phone)) {
    warnings.push(issue('missing_required_field', 'tenant.phone', 'Telefon fehlt.', 'warning'));
  }
  if (!isValidEmail(input.email)) {
    errors.push(issue('invalid_format', 'tenant.email', 'E-Mail fehlt oder ist ungültig.'));
  }
  if (!hasText(input.managementName)) {
    warnings.push(
      issue('missing_required_field', 'tenant.management', 'Geschäftsführung fehlt.', 'warning'),
    );
  }
  if (!hasText(input.taxId)) {
    warnings.push(issue('missing_required_field', 'tenant.tax_id', 'Steuernummer fehlt.', 'warning'));
  }

  if (input.invoicesEnabled) {
    if (!hasText(input.bankName) || !isValidIban(input.iban)) {
      errors.push(
        issue('missing_bank_account', 'tenant.bank', 'Bankverbindung für Rechnungen unvollständig.'),
      );
      actions.push('Bankname und IBAN im Firmenprofil hinterlegen.');
    }
    if (input.paymentTermsDays == null || input.paymentTermsDays <= 0) {
      errors.push(
        issue('missing_required_field', 'tenant.payment_terms', 'Zahlungsziel fehlt.'),
      );
    }
    if (!hasText(input.taxStatus)) {
      errors.push(issue('missing_tax_logic', 'tenant.tax_status', 'Steuerstatus fehlt.'));
    }
  }

  if (input.statutoryBillingActive) {
    if (!hasText(input.ikNumber)) {
      errors.push(
        issue('missing_ik_data', 'tenant.ik_number', 'IK-Nummer fehlt — gesetzliche Abrechnung blockiert.'),
      );
      actions.push('IK-Nummer im Abrechnungsprofil hinterlegen.');
    }
    if (!hasText(input.bankName) || !isValidIban(input.iban)) {
      errors.push(
        issue('missing_bank_account', 'tenant.bank', 'Bankverbindung für Abrechnung fehlt.'),
      );
    }
  }

  return buildResult('tenant', input.tenantId, errors, warnings, actions);
}

export function validateClientMasterData(input: ClientMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Klient:in');
  if (crossTenant) errors.push(crossTenant);

  if (!hasText(input.firstName) || !hasText(input.lastName)) {
    errors.push(issue('missing_required_field', 'client.name', 'Name der Klient:in fehlt.'));
  }
  if (!hasText(input.status)) {
    errors.push(issue('missing_required_field', 'client.status', 'Status fehlt.'));
  }

  if (input.requiresOnSiteAddress) {
    if (!hasText(input.street) || !hasText(input.zip) || !hasText(input.city)) {
      errors.push(
        issue('missing_required_field', 'client.address', 'Adresse für Hausbesuch fehlt.'),
      );
      actions.push('Einsatzadresse der Klient:in ergänzen.');
    }
  }

  if (input.requiresBudget) {
    if (input.careLevel == null || input.careLevel < 1 || input.careLevel > 5) {
      warnings.push(
        issue('missing_budget', 'client.care_level', 'Pflegegrad fehlt — Budgetprüfung eingeschränkt.', 'warning'),
      );
    }
  }

  if (!input.selfPayer && !hasText(input.costCarrierId)) {
    errors.push(
      issue('missing_billing_data', 'client.cost_carrier', 'Kostenträger oder Selbstzahler fehlt.'),
    );
  }

  if (!hasText(input.invoiceRecipientName)) {
    warnings.push(
      issue('missing_recipient', 'client.invoice_recipient', 'Rechnungsempfänger nicht hinterlegt.', 'warning'),
    );
  }

  if (!input.hasConsents) {
    warnings.push(
      issue('missing_consent', 'client.consents', 'Einwilligungen unvollständig.', 'warning'),
    );
    actions.push('Einwilligungen der Klient:in prüfen und dokumentieren.');
  }

  if (input.portalAccessConfigured === false) {
    warnings.push(
      issue('missing_permission', 'client.portal_access', 'Portalzugang nicht konfiguriert.', 'warning'),
    );
  }

  return buildResult('client', input.clientId, errors, warnings, actions);
}

export function validateEmployeeMasterData(input: EmployeeMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  if (!hasText(input.firstName) || !hasText(input.lastName)) {
    errors.push(issue('missing_required_field', 'employee.name', 'Name fehlt.'));
  }
  if (!hasText(input.roleKey)) {
    errors.push(issue('missing_required_field', 'employee.role', 'Rolle fehlt.'));
  }
  if (!hasText(input.status)) {
    errors.push(issue('missing_required_field', 'employee.status', 'Status fehlt.'));
  }
  if (!hasText(input.email) && !hasText(input.phone)) {
    errors.push(issue('missing_required_field', 'employee.contact', 'Kontaktdaten fehlen.'));
    actions.push('E-Mail oder Telefon der Mitarbeitenden hinterlegen.');
  }

  if (input.requiresCareQualification && !hasText(input.qualification)) {
    errors.push(
      issue('missing_required_field', 'employee.qualification', 'Pflegequalifikation fehlt.'),
    );
  }

  if (input.portalAccessConfigured === false) {
    warnings.push(
      issue('missing_permission', 'employee.portal_access', 'Portalzugang nicht konfiguriert.', 'warning'),
    );
  }

  return buildResult('employee', input.employeeId, errors, warnings, actions);
}

export function validateAssignmentData(input: AssignmentMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Einsatz');
  if (crossTenant) errors.push(crossTenant);

  if (!hasText(input.clientId)) {
    errors.push(issue('missing_required_field', 'assignment.client_id', 'Klient:in fehlt.'));
    actions.push('Klient:in für Einsatzplanung auswählen.');
  }
  if (!hasText(input.assignmentDate)) {
    errors.push(issue('missing_required_field', 'assignment.date', 'Datum fehlt.'));
  }
  if (!hasText(input.plannedStartTime) || !hasText(input.plannedEndTime)) {
    errors.push(issue('missing_required_field', 'assignment.time', 'Zeitfenster fehlt.'));
  }
  if (!hasText(input.serviceType)) {
    errors.push(issue('missing_required_field', 'assignment.service_type', 'Leistungsart fehlt.'));
  }
  if (!input.tasks?.some((t) => t.trim())) {
    errors.push(issue('missing_required_field', 'assignment.tasks', 'Aufgaben fehlen.'));
  }
  if (!hasText(input.street) || !hasText(input.city)) {
    errors.push(issue('missing_required_field', 'assignment.address', 'Einsatzadresse fehlt.'));
  }

  if (!input.isOpen && !hasText(input.employeeId)) {
    errors.push(issue('missing_required_field', 'assignment.employee_id', 'Mitarbeitende:r fehlt.'));
  }

  if (input.signatureRequired && input.signatureStatus === 'missing') {
    warnings.push(
      issue('missing_signature', 'assignment.signature', 'Unterschrift ausstehend.', 'warning'),
    );
  }
  if (input.docStatus === 'missing') {
    warnings.push(
      issue('missing_documentation', 'assignment.documentation', 'Dokumentation fehlt.', 'warning'),
    );
  }

  return buildResult('assignment', input.assignmentId, errors, warnings, actions);
}

export function validateServiceRecordData(input: ServiceRecordMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Leistungsnachweis');
  if (crossTenant) errors.push(crossTenant);

  if (!hasText(input.assignmentId)) {
    errors.push(issue('missing_required_field', 'service_record.assignment_id', 'Einsatzbezug fehlt.'));
  }
  if (!hasText(input.clientId)) {
    errors.push(issue('missing_required_field', 'service_record.client_id', 'Klient:in fehlt.'));
  }
  if (!hasText(input.employeeId)) {
    errors.push(issue('missing_required_field', 'service_record.employee_id', 'Mitarbeitende:r fehlt.'));
  }
  if (!hasText(input.startTime) || !hasText(input.endTime)) {
    errors.push(issue('missing_required_field', 'service_record.times', 'Zeiten fehlen.'));
  }
  if ((input.durationMinutes ?? 0) <= 0) {
    errors.push(issue('invalid_format', 'service_record.duration', 'Dauer ungültig.'));
  }
  if (!hasText(input.serviceType)) {
    errors.push(issue('missing_required_field', 'service_record.service_type', 'Leistung fehlt.'));
  }
  if (!input.tasksCompleted) {
    errors.push(issue('missing_required_field', 'service_record.tasks', 'Aufgaben nicht dokumentiert.'));
  }
  if (input.documentationStatus === 'missing') {
    errors.push(
      issue('missing_documentation', 'service_record.documentation', 'Dokumentation fehlt.'),
    );
    actions.push('Leistungsdokumentation ergänzen.');
  }
  if (input.signatureStatus === 'missing') {
    errors.push(
      issue('missing_signature', 'service_record.signature', 'Unterschrift fehlt — Nachweis blockiert.'),
    );
  }
  if (!input.budgetChecked) {
    warnings.push(
      issue('missing_budget', 'service_record.budget', 'Budget nicht geprüft.', 'warning'),
    );
  }
  if (input.reviewStatus === 'needs_review') {
    return buildResult('service_record', input.serviceRecordId, errors, warnings, [
      ...actions,
      'Leistungsnachweis durch PDL prüfen.',
    ]);
  }

  return buildResult('service_record', input.serviceRecordId, errors, warnings, actions);
}

export function validateBillingReadiness(input: BillingReadinessInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Abrechnung');
  if (crossTenant) errors.push(crossTenant);

  if (input.pflegegrad == null || input.pflegegrad < 1 || input.pflegegrad > 5) {
    errors.push(issue('missing_billing_data', 'billing.pflegegrad', 'Pflegegrad fehlt.'));
  }
  if (!input.hasLeistungsnachweis) {
    errors.push(
      issue('missing_documentation', 'billing.leistungsnachweis', 'Leistungsnachweis fehlt — Abrechnung blockiert.'),
    );
  }
  if (!input.hasUnterschrift) {
    warnings.push(
      issue('missing_signature', 'billing.unterschrift', 'Unterschrift fehlt.', 'warning'),
    );
  }
  if (!hasText(input.costCarrierId)) {
    errors.push(issue('missing_billing_data', 'billing.cost_carrier', 'Kostenträger fehlt.'));
  }
  if (input.statutoryBillingActive && !hasText(input.tenantIkNumber)) {
    errors.push(issue('missing_ik_data', 'billing.ik', 'Mandanten-IK fehlt.'));
    actions.push('IK-Profil im Abrechnungsbereich vervollständigen.');
  }
  if (input.budgetAvailableCents == null) {
    warnings.push(issue('missing_budget', 'billing.budget', 'Budget nicht hinterlegt.', 'warning'));
  } else if (
    input.amountCents != null &&
    input.amountCents > input.budgetAvailableCents
  ) {
    errors.push(issue('missing_budget', 'billing.budget', 'Betrag übersteigt Budget.'));
  }

  return buildResult('tenant', input.billingCaseId, errors, warnings, actions);
}

export function validateDocumentReadiness(input: DocumentReadinessInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Dokument');
  if (crossTenant) errors.push(crossTenant);

  if (!input.templateActive) {
    errors.push(issue('missing_template_data', 'document.template', 'Keine aktive Vorlage.'));
  }
  if (!input.requiredFieldsFilled) {
    errors.push(
      issue('missing_template_data', 'document.required_fields', 'Pflichtfelder unvollständig.'),
    );
    actions.push('Pflichtfelder in der Vorlage ausfüllen.');
  }
  if (!input.previewConfirmed) {
    errors.push(issue('missing_required_field', 'document.preview', 'Vorschau nicht bestätigt.'));
  }
  if (!input.pdfGenerated) {
    warnings.push(
      issue('missing_required_field', 'document.pdf', 'PDF noch nicht erzeugt.', 'warning'),
    );
  }
  if (!input.hashPresent) {
    warnings.push(
      issue('missing_required_field', 'document.hash', 'Integritäts-Hash fehlt.', 'warning'),
    );
  }

  return buildResult('document', input.documentId, errors, warnings, actions);
}

export function validatePortalAccess(input: PortalAccessInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Portal');
  if (crossTenant) errors.push(crossTenant);

  if (!input.accessAssigned) {
    errors.push(
      issue('missing_permission', 'portal.access', 'Keine klare Zugangszuweisung — Portal blockiert.'),
    );
    actions.push('Portalzugang für die Person konfigurieren.');
  }
  if (!input.privacyCheckDone) {
    warnings.push(
      issue('missing_consent', 'portal.privacy', 'Datenschutz-/Freigabeprüfung ausstehend.', 'warning'),
    );
  }
  if (input.roleAuthorized === false) {
    errors.push(
      issue('missing_permission', 'portal.role', 'Rollenbasierte Autorisierung fehlt.'),
    );
  }

  return buildResult('portal', input.portalId, errors, warnings, actions);
}

export function validateInvoiceMasterData(input: InvoiceMasterDataInput): DataQualityResult {
  const errors: DataQualityIssue[] = [];
  const warnings: DataQualityIssue[] = [];
  const actions: string[] = [];

  const crossTenant = assertSameTenant(input.tenantId, input.contextTenantId, 'Rechnung');
  if (crossTenant) errors.push(crossTenant);

  if (!hasText(input.invoiceNumber)) {
    errors.push(issue('missing_required_field', 'invoice.number', 'Rechnungsnummer fehlt.'));
  }
  if (!hasText(input.recipientName)) {
    errors.push(issue('missing_recipient', 'invoice.recipient', 'Rechnungsempfänger fehlt.'));
  }
  if (!hasText(input.recipientStreet) || !hasText(input.recipientCity)) {
    errors.push(issue('missing_recipient', 'invoice.recipient_address', 'Empfängeradresse unvollständig.'));
  }
  if (!hasText(input.invoiceDate)) {
    errors.push(issue('missing_required_field', 'invoice.date', 'Rechnungsdatum fehlt.'));
  }
  if (!hasText(input.servicePeriod)) {
    errors.push(issue('missing_required_field', 'invoice.period', 'Leistungszeitraum fehlt.'));
  }
  if ((input.lineItemCount ?? 0) === 0) {
    errors.push(issue('missing_required_field', 'invoice.lines', 'Positionen fehlen.'));
  }
  if (input.netTotalCents == null || input.grossTotalCents == null) {
    errors.push(issue('missing_required_field', 'invoice.totals', 'Summen fehlen.'));
  }
  if (!hasText(input.taxNote) || input.taxLogicValid === false) {
    errors.push(issue('missing_tax_logic', 'invoice.tax', 'Steuerlogik unvollständig.'));
  }
  if (input.paymentTermsDays == null || input.paymentTermsDays <= 0) {
    errors.push(issue('missing_required_field', 'invoice.payment_terms', 'Zahlungsziel fehlt.'));
  }
  if (!hasText(input.bankName) || !isValidIban(input.iban)) {
    errors.push(issue('missing_bank_account', 'invoice.bank', 'Bankverbindung fehlt.'));
    actions.push('Bankverbindung im Firmenprofil prüfen.');
  }
  if (!input.footerPresent) {
    warnings.push(
      issue('missing_required_field', 'invoice.footer', 'Rechnungsfuß fehlt.', 'warning'),
    );
  }
  if (!hasText(input.pdfRef)) {
    warnings.push(
      issue('missing_required_field', 'invoice.pdf', 'PDF-Referenz fehlt.', 'warning'),
    );
  }

  return buildResult('invoice', input.invoiceId, errors, warnings, actions);
}

export function isBlockingResult(result: DataQualityResult): boolean {
  return result.blockingIssues.length > 0 || result.status === 'blocked';
}
