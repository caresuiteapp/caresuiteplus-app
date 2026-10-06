import { consoleLabel } from './consoleWorkspaceModel';

const names: Record<string, string> = {
  office: 'Unternehmensverwaltung', assist: 'Alltagsbegleitung', care: 'Ambulante Pflege',
  employee: 'Mitarbeitende', client: 'Klient:innen', owner: 'Geschäftsführung', admin: 'Verwaltung',
  manager: 'Leitung', staff: 'Mitarbeitende', viewer: 'Lesezugriff', professional: 'Professionell', starter: 'Basis',
  free_platform: 'CareSuite kostenlos', enterprise: 'Großunternehmen', sms_pack: 'SMS-Paket',
  beta_free: 'Erprobung (kostenlos)', internal: 'Interne Nutzung', custom: 'Individueller Vertrag',
  employee_portal: 'Mitarbeitendenportal', client_portal: 'Klientenportal', stationary: 'Stationäre Pflege',
  consulting: 'Beratung', academy: 'Schulungen', messaging: 'Nachrichten', documents: 'Dokumente',
  signatures: 'Unterschriften', billing: 'Abrechnung', timekeeping: 'Zeiterfassung', workforce: 'Personalplanung',
  ai_assist: 'Digitale Unterstützung',
  max_users: 'Benutzerkonten', max_clients: 'Klient:innen', max_employees: 'Mitarbeitende',
  max_storage_mb: 'Speicherplatz (MB)', enabled: 'Freigegeben', beta_enabled: 'Erprobung freigegeben',
  override: 'Individuelle Vereinbarung', manual_override: 'Individuelle Vereinbarung', plan: 'Tarif',
  addon: 'Zusatzpaket', subscription: 'Vertrag', free: 'Kostenlos', inherited: 'Aus dem Vertrag',
  sending: 'Versand läuft', sent: 'Vom Versanddienst angenommen', cancelled: 'Beendet',
  info: 'Information', warning: 'Warnung', error: 'Fehler', critical: 'Kritisch',
  'module.enabled': 'Funktionsbereich freigegeben', 'module.disabled': 'Funktionsbereich deaktiviert',
  'module.status_changed': 'Funktionsfreigabe geändert', 'tenant.status_changed': 'Unternehmensstatus geändert',
  'tenant.record_updated': 'Stammdaten aktualisiert', 'plan.assigned': 'Tarif zugewiesen',
  'plan.archived': 'Überholter Katalogeintrag archiviert',
  'subscription.plan_assigned': 'Tarif zugewiesen', 'subscription.suspended': 'Vertrag pausiert',
  'subscription.reactivated': 'Vertrag fortgesetzt', 'subscription.cancelled': 'Vertrag beendet',
  'addon.assigned': 'Zusatzpaket zugewiesen', 'addon.removed': 'Zusatzpaket beendet',
  'tenant.addon.assigned': 'Zusatzpaket zugewiesen', 'tenant.addon.removed': 'Zusatzpaket beendet',
  'invoice.status_changed': 'Rechnungsstatus geändert', 'payment.status_changed': 'Zahlungsstatus geändert',
  'tenant.account.email_changed': 'Anmelde-E-Mail korrigiert', 'tenant.account.password_recovery': 'Passwortwiederherstellung versendet',
  'tenant.account.welcome_resent': 'Willkommensmail erneut beauftragt', 'tenant.account.requested': 'Kontoverwaltung beauftragt',
  'tenant.account.failed': 'Kontoverwaltung konnte nicht abgeschlossen werden',
};

/** Technical identifiers stay in storage; the working surface uses readable labels. */
export function platformName(value: unknown, fallback = 'Weitere Angabe'): string {
  if (value == null || value === '') return '—';
  const key = String(value);
  const label = names[key] ?? consoleLabel(key);
  return label !== key || !/^[a-z][a-z0-9_.-]*$/.test(key) ? label : fallback;
}

export function platformActionLabel(value: unknown): string {
  return names[String(value)] ?? 'Änderung dokumentiert';
}

export function platformMailIssue(value: unknown): string {
  const key = String(value ?? '');
  if (!key) return 'Keine Versandstörung gemeldet.';
  if (/config|provider|sender/.test(key)) return 'Versanddienst oder Absender muss geprüft werden.';
  if (/window|review/.test(key)) return 'Die bisherige Zustellung ist unklar. Bitte vor einem erneuten Versand prüfen.';
  if (/account|changed/.test(key)) return 'Die Empfängeradresse stimmt nicht mehr mit dem aktiven Konto überein.';
  if (/rate|429/.test(key)) return 'Der Versanddienst hat weitere Anfragen vorübergehend begrenzt.';
  return 'Der Versand konnte nicht bestätigt werden. Bitte die Adresse und den Versanddienst prüfen.';
}
