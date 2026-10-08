import { HeartIcon, SparkleIcon } from "@phosphor-icons/react/ssr";

const red = ["Wrapped by hand", "Crochet bouquets", "Gift hampers", "Plushies", "Brass lamps", "Fix rate, always"];
const lagoon = ["Birthdays", "Anniversaries", "Diwali", "Housewarmings", "Rakhi", "Just because"];

/** Two marquee bands crossed like the ribbon on a parcel. */
export function RibbonCross() {
  return (
    <section aria-label="What we do" className="relative h-44 overflow-hidden sm:h-52">
      <Band words={lagoon} className="top-1/2 -translate-y-1/2 rotate-[3deg] bg-lagoon text-ink" reverse icon="heart" />
      <Band words={red} className="top-1/2 -translate-y-1/2 -rotate-[3deg] bg-ribbon text-white shadow-[0_10px_30px_-10px_rgb(176_30_59/0.6)]" />
    </section>
  );
}

function Band({ words, className, reverse, icon = "spark" }: { words: string[]; className: string; reverse?: boolean; icon?: "spark" | "heart" }) {
  const row = [...words, ...words];
  return (
    <div className={`absolute -inset-x-10 border-y-[3px] border-ink py-3.5 ${className}`}>
      <div className={`flex w-max ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}>
        {[0, 1].map((k) => (
          <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <li key={i} className="flex items-center gap-6 px-3 font-display text-2xl font-extrabold tracking-tight whitespace-nowrap uppercase sm:text-3xl">
                {w}
                {icon === "heart" ? <HeartIcon size={22} weight="fill" className="text-ribbon" /> : <SparkleIcon size={22} weight="fill" className="text-sun" />}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
