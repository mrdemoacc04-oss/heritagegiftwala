import { cx } from "@/lib/format";

/** The red "Making a new gift" banner from the logo, as a reusable label. */
export function Ribbon({
  children,
  className,
  tone = "ribbon",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "ribbon" | "lagoon" | "sun" | "ink";
}) {
  const body = {
    ribbon: "bg-ribbon text-white",
    lagoon: "bg-lagoon text-ink",
    sun: "bg-sun text-ink",
    ink: "bg-ink text-white",
  }[tone];
  const tail = {
    ribbon: "bg-ribbon-700",
    lagoon: "bg-lagoon-600",
    sun: "bg-[#e9a919]",
    ink: "bg-[#3b3550]",
  }[tone];
  const notch = "[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,38%_50%)]";
  return (
    <span className={cx("relative inline-flex items-center", className)}>
      <span aria-hidden className={cx("absolute -left-4 top-[22%] h-full w-7", tail, notch)} />
      <span aria-hidden className={cx("absolute -right-4 top-[22%] h-full w-7 -scale-x-100", tail, notch)} />
      <span
        className={cx(
          "relative rounded-[3px] px-4 py-1 font-display text-[0.8rem] font-bold uppercase tracking-[0.14em] whitespace-nowrap",
          body,
        )}
      >
        {children}
      </span>
    </span>
  );
}
