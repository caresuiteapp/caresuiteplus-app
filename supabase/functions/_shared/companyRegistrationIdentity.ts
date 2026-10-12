type IdentityClient = {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): PromiseLike<{ data: { session?: { access_token: string } | null }; error: unknown }>;
    getUser(token: string): PromiseLike<{ data: { user: { id: string; email?: string } | null }; error: unknown }>;
  };
};

/** A repeat request may resume only the identity verified by the entered password. */
export async function verifyRegistrationIdentity(client: IdentityClient, email: string, password: string): Promise<string | null> {
  try {
    const login = await client.auth.signInWithPassword({ email, password });
    const token = login.data?.session?.access_token;
    if (login.error || typeof token !== 'string' || !token) return null;
    const verification = await client.auth.getUser(token);
    const user = verification.data?.user;
    if (verification.error || typeof user?.id !== 'string' || !user.id || user.email?.trim().toLowerCase() !== email) return null;
    return user.id;
  } catch { return null; }
}
