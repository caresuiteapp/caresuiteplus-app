const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|api[_-]?key|authorization|bearer|credential|private[_-]?key|session|cookie|ssn|iban|credit/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function sanitizeLogMessage(raw: string): string {
  let message = raw.trim();
  message = message.replace(BEARER_PATTERN, 'Bearer [REDACTED]');
  message = message.replace(JWT_PATTERN, '[REDACTED_JWT]');
  message = message.replace(IBAN_PATTERN, '[REDACTED_IBAN]');
  message = message.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
  message = message.replace(/("password"\s*:\s*")[^"]*(")/gi, '$1[REDACTED]$2');
  message = message.replace(/password\s*=\s*"[^"]*"/gi, 'password="[REDACTED]"');
  message = message.replace(/(api[_-]?key\s*[=:]\s*)[^\s,&]+/gi, '$1[REDACTED]');
  return message.slice(0, 4000);
}

export function sanitizeLogMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  if (!metadata) return {};
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    sanitized[key] = sanitizeLogMessage(String(value)).slice(0, 500);
  }
  return sanitized;
}
