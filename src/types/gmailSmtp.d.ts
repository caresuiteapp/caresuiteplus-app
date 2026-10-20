/** The deployed Edge runtime resolves this pinned, server-only npm import. */
declare module 'npm:nodemailer@10.0.15' {
  const nodemailer: {
    createTransport(options: Record<string, unknown>): {
      sendMail(message: Record<string, unknown>): Promise<{ accepted?: unknown[]; messageId?: string }>;
      close(): void;
    };
  };
  export default nodemailer;
}
