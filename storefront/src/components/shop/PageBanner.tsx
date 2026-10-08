import Image from "next/image";
import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { Product } from "@/lib/types";

/** Tinted page header with a few product cutouts tumbling in from the right. */
export function PageBanner({
  eyebrow,
  title,
  blurb,
  tint,
  cutouts,
  crumbs,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  tint: string;
  cutouts: Product[];
  crumbs: { href: string; label: string }[];
}) {
  const spots = [
    "right-[4%] top-[10%] w-[22%] rotate-[8deg]",
    "right-[24%] bottom-[-6%] w-[17%] -rotate-[10deg]",
    "right-[-2%] bottom-[-10%] w-[16%] rotate-[14deg]",
  ];
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-4 pb-10 sm:px-6">
      <div className="relative overflow-hidden rounded-[2.5rem] px-6 py-10 sm:rounded-[3rem] sm:px-12 sm:py-14" style={{ background: tint }}>
        <div aria-hidden className="dots absolute inset-0 opacity-60 [--dot-gap:22px]" />
        <nav aria-label="Breadcrumb" className="relative flex items-center gap-1 text-sm font-semibold text-ink/70">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <CaretRightIcon size={12} weight="bold" />}
              <Link href={c.href} className="hover:text-ink hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="relative max-w-xl md:max-w-[52%]">
          <p className="mt-5 font-hand text-3xl text-ribbon">{eyebrow}</p>
          <h1 className="mt-1 text-[clamp(2.6rem,6vw,5rem)] leading-[0.92] font-extrabold">{title}</h1>
          <p className="mt-4 text-lg text-ink/75">{blurb}</p>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          {cutouts.slice(0, 3).map((p, i) => (
            <Image key={p.handle} src={p.image} alt="" width={320} height={320} className={`product-shadow absolute animate-bob ${spots[i]}`} style={{ animationDelay: `${i * -1.4}s` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
