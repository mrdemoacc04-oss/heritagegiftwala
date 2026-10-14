import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * One small connection pool per server instance. On Vercel use Supabase's "Transaction pooler"
 * connection string (port 6543), which is built for many short-lived serverless instances.
 */
const globalForPool = globalThis as unknown as { __shopPool?: Pool };

function create(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Client-side timeout. A server-side statement_timeout would be sent as a startup parameter, which connection poolers reject.
    query_timeout: 15_000,
    // Supabase requires TLS. Pin Supabase's CA via DATABASE_SSL_CA for full verification; without it
    // the connection is still encrypted but the server's certificate is not checked.
    ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  });
}

export const pool = () => (globalForPool.__shopPool ??= create());

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

export async function sqlOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await sql<T>(text, params))[0] ?? null;
}

/** Errors raised inside the database arrive as "CODE:detail". */
export function shopError(e: unknown): { code: string; detail: string } | null {
  const m = e instanceof Error ? /^([A-Z_]+):(.*)$/s.exec(e.message) : null;
  return m ? { code: m[1], detail: m[2] } : null;
}

const MESSAGES: Record<string, (detail: string) => string> = {
  EMPTY_CART: () => "Your bag is empty.",
  TOO_MANY_LINES: () => "That's a lot of different items. Please split it into two orders.",
  BAD_QUANTITY: () => "Please check the quantities in your bag.",
  UNKNOWN_PRODUCT: () => "One of the items in your bag isn't available any more. Please remove it and try again.",
  BAD_SHIPPING: () => "Please choose a delivery option.",
  BAD_COUPON: () => "That code can't be used on this order.",
  OUT_OF_STOCK: (d) => {
    const [title, left] = d.split("|");
    return Number(left) > 0 ? `Only ${left} of "${title}" left. Please lower the quantity.` : `"${title}" just sold out.`;
  },
};

export const friendlyOrderError = (code: string, detail: string) => (MESSAGES[code] ?? (() => "We couldn't place that order. Please try again."))(detail);
