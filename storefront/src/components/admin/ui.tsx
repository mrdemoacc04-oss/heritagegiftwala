import Link from "next/link";
import { cx } from "@/lib/format";

/** Small building blocks shared by every admin page. Plain and quick to read: this is a tool, not a shop window. */

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";

export const buttonClass = (kind: "primary" | "secondary" | "danger" | "ghost" = "primary", size: "md" | "sm" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50",
    size === "md" ? "px-4 py-2 text-[15px]" : "px-3 py-1.5 text-sm",
    kind === "primary" && "bg-stone-900 text-white hover:bg-stone-700",
    kind === "secondary" && "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
    kind === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
    kind === "ghost" && "text-stone-700 hover:bg-stone-100",
  );

export function PageTitle({ title, hint, actions }: { title: string; hint?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {hint && <p className="mt-1 max-w-2xl text-sm text-stone-600">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-stone-200 bg-white p-5", className)}>
      {title && <h2 className="mb-4 text-base font-bold text-stone-900">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const TONES = {
  gray: "bg-stone-100 text-stone-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>;
}

export const STATUS_LABEL: Record<string, { label: string; tone: keyof typeof TONES }> = {
  placed: { label: "New", tone: "blue" },
  packed: { label: "Packed", tone: "amber" },
  shipped: { label: "Shipped", tone: "amber" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const rupees = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export const when = (d: string | Date | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">{children}</p>;
}

export function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", active ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100")}>
      {children}
    </Link>
  );
}
