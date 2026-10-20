# CareSuite+ — KI/OCR-Provider (Arbeitspaket 017)

## Ziel

Provider-Registry für Integrationen mit `secret_reference`-Muster — keine Secrets im Frontend.

## Registry

```typescript
import {
  PROVIDER_REGISTRY,
  getProviderByKey,
  getOcrProviders,
  resolveSecretReference,
} from '@/lib/integrations';
```

## Sicherheit

| Feld | Inhalt |
|------|--------|
| `secretReferenceKey` | z. B. `vault:integration-azure-di` |
| Echter Secret-Wert | Nur in Supabase Vault / Edge Functions |

## Anbieter

- DATEV, Lexoffice (Buchhaltung)
- Azure Document Intelligence (OCR)
- OpenAI (KI)
- Twilio (Messaging)

## Demo

`buildDemoProviderInstances()` liefert konfigurierte und ausstehende Integrationen ohne echte Credentials.
