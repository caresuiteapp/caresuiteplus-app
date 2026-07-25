export type LiquidSession = {
  userId: string;
  tenantId: string;
  role: string;
};

export type LiquidCommandPriority = {
  id: string;
  title: string;
  context: string;
  dueLabel: string;
};

export interface LiquidCommandDataPort {
  getSession(): Promise<LiquidSession | null>;
  listPriorities(session: LiquidSession): Promise<LiquidCommandPriority[]>;
}

export class UnconfiguredLiquidCommandDataPort
  implements LiquidCommandDataPort
{
  async getSession(): Promise<LiquidSession | null> {
    return null;
  }

  async listPriorities(): Promise<LiquidCommandPriority[]> {
    return [];
  }
}

