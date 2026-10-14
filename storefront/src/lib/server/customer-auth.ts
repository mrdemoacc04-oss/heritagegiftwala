import "server-only";
import { cookies } from "next/headers";
import { sql, sqlOne } from "./db";
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";
import { allow, hashed, ipKey } from "./security";
import { cookieName, cookieOptions, createSession, destroySession, readSession } from "./sessions";

export type CustomerRow = { id: string; email: string; first_name: string; last_name: string; phone: string; created_at: string };

const COLUMNS = "u.email, u.first_name, u.last_name, u.phone, u.created_at";

export async function currentCustomer(): Promise<CustomerRow | null> {
  const token = (await cookies()).get(cookieName("customer"))?.value;
  return readSession<Omit<CustomerRow, "id">>("customer", token, COLUMNS);
}

export async function startCustomerSession(customerId: string) {
  const jar = await cookies();
  const options = cookieOptions("customer");
  jar.set(cookieName("customer"), await createSession("customer", customerId), options);
  // A readable hint (not the session itself) so the browser knows whether to ask who is signed in.
  jar.set("hgw_in", "1", { ...options, httpOnly: false });
}

export async function endCustomerSession() {
  const jar = await cookies();
  const token = jar.get(cookieName("customer"))?.value;
  if (token) await destroySession("customer", token);
  jar.delete(cookieName("customer"));
  jar.delete("hgw_in");
}

const WRONG = "That email and password don't match. Please try again.";

export async function customerLogin(h: Headers, emailRaw: string, password: string): Promise<{ error: string } | { id: string }> {
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const ip = ipKey(h);
  if (!(await allow(`login:ip:${ip}`, 20, 15 * 60)) || !(await allow(`login:acct:${ip}:${hashed(email)}`, 8, 15 * 60))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const row = await sqlOne<{ id: string; password_hash: string }>("select id, password_hash from shop.customers where email = $1", [email]);
  const ok = row ? await verifyPassword(password.slice(0, 200), row.password_hash) : (await verifyAgainstDummy(password.slice(0, 200)), false);
  return row && ok ? { id: row.id } : { error: WRONG };
}

export type RegisterInput = { first_name: string; last_name: string; email: string; phone: string; password: string };

export async function customerRegister(h: Headers, input: RegisterInput): Promise<{ error: string } | { id: string }> {
  const ip = ipKey(h);
  if (!(await allow(`register:ip:${ip}`, 6, 60 * 60))) return { error: "Too many sign-ups from this connection. Please try again later." };
  const problem = passwordProblem(input.password, 8);
  if (problem) return { error: problem };
  const hash = await hashPassword(input.password);
  const rows = await sql<{ id: string }>(
    `insert into shop.customers (email, first_name, last_name, phone, password_hash) values ($1,$2,$3,$4,$5)
     on conflict (email) do nothing returning id`,
    [input.email, input.first_name, input.last_name, input.phone, hash],
  );
  return rows[0] ? { id: rows[0].id } : { error: "An account with this email already exists. Try signing in instead." };
}
