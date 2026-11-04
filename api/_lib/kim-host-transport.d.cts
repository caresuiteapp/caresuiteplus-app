import type {KimHostCommand} from '../../src/lib/gkvExchange/kimReceiveContract';
export function callKimHost(env: Record<string, string | undefined>, input: KimHostCommand): Promise<unknown>;
