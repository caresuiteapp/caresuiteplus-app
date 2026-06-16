import type {
  ConnectAdapterResult,
  ConnectCapability,
  ConnectCategoryKey,
  ConnectConnectorStatus,
  ConnectExecutionContext,
  ConnectProviderAdapter,
} from '@/types/connect/gateway';
import { buildConnectAuditDraft, recordConnectAuditDraft } from '../connectAudit';

export abstract class BaseConnectAdapter implements ConnectProviderAdapter {
  abstract providerKey: string;
  abstract category: ConnectCategoryKey;
  readonly isMockAdapter = true;

  protected defaultStatus: ConnectConnectorStatus = 'coming_soon';
  protected allowedActions: readonly string[] = ['test_connection', 'list_capabilities'];

  getAllowedActions(): readonly string[] {
    return this.allowedActions;
  }

  getStatus(_context: ConnectExecutionContext): ConnectConnectorStatus {
    return this.defaultStatus;
  }

  validateConfiguration(context: ConnectExecutionContext): ConnectAdapterResult {
    if (!context.hasCredentialReference && context.environment !== 'demo') {
      return this.blocked('Anbieter-Konfiguration fehlt.', 'validate_configuration');
    }
    return this.ok('Konfiguration formal gültig (Vorbereitung).', 'validate_configuration');
  }

  listCapabilities(_context: ConnectExecutionContext): ConnectCapability[] {
    return [
      {
        key: 'test_connection',
        title: 'Verbindungstest',
        description: 'Prüft Erreichbarkeit ohne Datentransfer',
        dataDirection: 'out',
        sensitiveDataLevel: 'none',
        status: this.defaultStatus,
      },
    ];
  }

  async testConnection(context: ConnectExecutionContext): Promise<ConnectAdapterResult> {
    if (context.environment === 'demo') {
      return this.demo('Demo-Verbindungstest — kein externer Aufruf.', 'test_connection');
    }
    return this.blocked(
      'Verbindungstest blockiert — Connector nicht produktiv freigegeben.',
      'test_connection',
    );
  }

  async execute(
    action: string,
    _payload: Record<string, unknown>,
    context: ConnectExecutionContext,
  ): Promise<ConnectAdapterResult> {
    if (context.environment === 'demo') {
      return this.demo(`Demo-Aktion „${action}" — keine externe Übertragung.`, action);
    }
    return this.blocked(`Aktion „${action}" blockiert — Connector in Vorbereitung.`, action);
  }

  audit(action: string, result: ConnectAdapterResult, context: ConnectExecutionContext) {
    const draft = buildConnectAuditDraft(context, action, result);
    return recordConnectAuditDraft(draft);
  }

  protected ok(message: string, auditAction: string): ConnectAdapterResult {
    return { ok: true, message, auditAction };
  }

  protected blocked(message: string, auditAction: string): ConnectAdapterResult {
    return { ok: false, blocked: true, message, auditAction };
  }

  protected demo(message: string, auditAction: string): ConnectAdapterResult {
    return { ok: true, demo: true, message, auditAction };
  }
}
