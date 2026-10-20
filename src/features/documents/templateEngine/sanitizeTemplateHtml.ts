import type { SanitizeHtmlResult, TemplateValidationIssue } from './types';

const BLOCKED_TAG_PATTERN = /<\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>[\s\S]*?(<\/\1\s*>)?/gi;
const SELF_CLOSING_BLOCKED = /<\s*(script|iframe|object|embed|input|meta|link|base)\b[^>]*\/?>/gi;
const EVENT_HANDLER_ATTR = /\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_ATTR = /\s(href|src|xlink:href|formaction)\s*=\s*("|')?\s*(javascript:|vbscript:|data:text\/html)/gi;
const CSS_EXPRESSION = /expression\s*\(/gi;

function issue(code: string, message: string): TemplateValidationIssue {
  return { code, message, severity: 'error' };
}

/** Entfernt gefährliche HTML-Inhalte — keine eval(), keine Script-Ausführung. */
export function sanitizeTemplateHtml(html: string): SanitizeHtmlResult {
  const blocked: TemplateValidationIssue[] = [];
  let sanitized = html ?? '';

  if (BLOCKED_TAG_PATTERN.test(sanitized) || SELF_CLOSING_BLOCKED.test(sanitized)) {
    blocked.push(issue('blocked_tag', 'Gefährliche HTML-Tags (script, iframe, …) sind nicht erlaubt.'));
  }
  sanitized = sanitized.replace(BLOCKED_TAG_PATTERN, '');
  sanitized = sanitized.replace(SELF_CLOSING_BLOCKED, '');

  if (EVENT_HANDLER_ATTR.test(sanitized)) {
    blocked.push(issue('blocked_event_handler', 'Inline-Event-Handler (onclick, …) sind nicht erlaubt.'));
  }
  sanitized = sanitized.replace(EVENT_HANDLER_ATTR, ' data-blocked-event="1"');

  if (UNSAFE_URL_ATTR.test(sanitized)) {
    blocked.push(issue('blocked_url_scheme', 'Unsichere URL-Schemata (javascript:, data:text/html) sind nicht erlaubt.'));
  }
  sanitized = sanitized.replace(UNSAFE_URL_ATTR, ' data-blocked-url="1"');

  if (CSS_EXPRESSION.test(sanitized)) {
    blocked.push(issue('blocked_css_expression', 'CSS expression() ist nicht erlaubt.'));
  }
  sanitized = sanitized.replace(CSS_EXPRESSION, 'blocked(');

  return { html: sanitized.trim(), blocked };
}
