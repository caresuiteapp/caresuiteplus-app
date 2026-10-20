export type AiExtensionCapability = 'summarize' | 'classify' | 'ocr' | 'assist';

export function createAiExtension(
  wpNumber: number,
  domain: string,
  capabilities: AiExtensionCapability[],
): { wpNumber: number; domain: string; capabilities: AiExtensionCapability[] } {
  return { wpNumber, domain, capabilities };
}
