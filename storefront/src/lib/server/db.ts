import "server-only";
import { Pool, type QueryResultRow } from "pg";
import { cleanDatabaseUrl, pgSsl } from "./pg-config";

/**
 * One small connection pool per server instance. On Vercel use Supabase's "Transaction pooler"
 * connection string (port 6543), which is built for many short-lived serverless instances.
 */
const globalForPool = globalThis as unknown as { __shopPool?: Pool };

function create(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const created = new Pool({
    // Any sslmode=… in the address would override the verified connection below, so it is stripped first.
    connectionString: cleanDatabaseUrl(url),
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Client-side timeout. The database's own limits (lock and statement timeouts) are applied per transaction in
    // callInTransaction, because a startup parameter would be rejected by connection poolers.
    query_timeout: 15_000,
    ssl: pgSsl(url),
  });
  // A connection that drops while idle must not crash the whole server.
  created.on("error", (e) => console.error("[db] an idle connection dropped:", e.message));
  return created;
}

export const pool = () => (globalForPool.__shopPool ??= create());

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

/**
 * Runs one statement inside a transaction with a 5-second wait for locks and a 15-second ceiling on running time,
 * enforced by the database itself (so a stuck order can't hold products locked, unlike a client-side timeout).
 * Used for placing and cancelling orders.
 */
export async function callInTransaction<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '15s'");
    const res = await client.query<T>(text, params);
    await client.query("commit");
    return res.rows;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function sqlOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await sql<T>(text, params))[0] ?? null;
}

/** Errors raised inside the database arrive as "CODE:detail". */
export function shopError(e: unknown): { code: string; detail: string } | null {
  const m = e instanceof Error ? /^([A-Z_]+):(.*)$/s.exec(e.message) : null;
  return m ? { code: m[1], detail: m[2] } : null;
}

/** Postgres says "busy": a lock wasn't free in time, a deadlock was broken up, or a statement ran too long. */
export const isBusy = (e: unknown) => ["55P03", "40P01", "57014"].includes((e as { code?: string } | null)?.code ?? "");

const MESSAGES: Record<string, (detail: string) => string> = {
  EMPTY_CART: () => "Your bag is empty.",
  TOO_MANY_LINES: () => "That's a lot of different items. Please split it into two orders.",
  BAD_QUANTITY: () => "Please check the quantities in your bag.",
  UNKNOWN_PRODUCT: () => "One of the items in your bag isn't available any more. Please remove it and try again.",
  BAD_SHIPPING: () => "Please choose a delivery option.",
  BAD_COUPON: () => "That code can't be used on this order.",
  ORDER_TOO_BIG: () => "That's a big order, which is lovely! Please message or call the shop so we can arrange it properly.",
  TOO_MANY_OF_ONE: (d) => {
    const [title, cap] = d.split("|");
    return `You can order up to ${cap} of "${title}" online at a time. For more, please message or call the shop.`;
  },
  TOO_MANY_OPEN: () => "You already have a few orders on their way. Once one is delivered you can order again, or call the shop.",
  PRICE_CHANGED: (d) => `The price changed while you were checking out. The new total is ₹${Number(d).toLocaleString("en-IN")}. Please check it and place the order again.`,
  OUT_OF_STOCK: (d) => {
    const [title, left] = d.split("|");
    return Number(left) > 0 ? `Only ${left} of "${title}" left. Please lower the quantity.` : `"${title}" just sold out.`;
  },
};

export const friendlyOrderError = (code: string, detail: string) => (MESSAGES[code] ?? (() => "We couldn't place that order. Please try again."))(detail);
