type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(value: unknown): unknown };
export function createKimHostHandler(dependencies: { env: Record<string, string | undefined>; fetch?: typeof fetch }): (req: Request, res: Response) => Promise<unknown>;
