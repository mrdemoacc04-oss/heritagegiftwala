import Image from "next/image";
import { MapPinIcon, NavigationArrowIcon, PhoneIcon, StarIcon } from "@phosphor-icons/react/ssr";
import { Ribbon } from "@/components/ui/Ribbon";
import { cx } from "@/lib/format";
import { site } from "@/lib/site";

/** The shop on Google Maps, framed like a postcard, with the address card beside it. */
export function ShopMap({ className }: { className?: string }) {
  const { address, phone, googleRating } = site;
  return (
    <div id="map" className={cx("grid scroll-mt-28 gap-6 lg:grid-cols-[1.55fr_1fr]", className)}>
      <div className="relative">
        <div className="relative h-[380px] overflow-hidden rounded-[2.25rem] border-[3px] border-ink bg-lagoon-100 shadow-[8px_8px_0_var(--color-ink)] sm:h-[460px]">
          <iframe
            src={site.mapEmbedUrl}
            title={`Map showing ${site.name} on ${address.street}, ${address.city}`}
            className="absolute inset-0 size-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <span className="absolute -top-4 right-8 rotate-3">
          <Ribbon>Find us in {address.city}</Ribbon>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[2.25rem] bg-lagoon p-7 sm:p-8">
        <div aria-hidden className="dots absolute inset-0 opacity-40 [--dot-gap:22px]" />
        <div className="relative">
          <p className="font-hand text-3xl text-ribbon-700">drop by!</p>
          <h3 className="mt-1 text-3xl leading-tight font-extrabold">
            {site.name}, {address.city}
          </h3>

          <address className="mt-5 flex gap-3 text-lg not-italic">
            <MapPinIcon size={24} weight="fill" className="mt-0.5 shrink-0 text-ribbon" />
            <span>
              {address.street}
              <br />
              {address.landmark}
              <br />
              {address.city}, {address.state} {address.pincode}
            </span>
          </address>
          <figure className="mt-5 -rotate-1">
            <Image
              src={site.storePhoto.src}
              alt={`The ${site.name} shop front, with its pink sign and balloons`}
              width={site.storePhoto.width}
              height={site.storePhoto.height}
              sizes="(min-width: 1024px) 30vw, 90vw"
              className="w-full rounded-2xl border-2 border-ink object-cover shadow-[4px_4px_0_var(--color-ink)]"
            />
            <figcaption className="mt-2 font-hand text-2xl leading-tight">Look for the pink sign, right opposite Yash Plaza ♥</figcaption>
          </figure>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold">
            <a href={`tel:${phone.tel}`} className="flex items-center gap-2 hover:underline">
              <PhoneIcon size={20} weight="fill" /> {phone.display}
            </a>
            <a href={googleRating.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:underline">
              <span className="flex" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <StarIcon key={i} size={16} weight="fill" className={i < Math.round(googleRating.score) ? "text-ink" : "text-ink/25"} />
                ))}
              </span>
              {googleRating.score} on Google · {googleRating.count} reviews
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={site.directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-bold text-white shadow-[0_5px_0_var(--color-ribbon)] transition hover:bg-ribbon hover:shadow-[0_5px_0_var(--color-ink)] active:translate-y-1 active:shadow-none"
            >
              <NavigationArrowIcon size={20} weight="fill" /> Get directions
            </a>
            <a href={`tel:${phone.tel}`} className="flex items-center gap-2 rounded-full border-2 border-ink bg-white px-6 py-3 font-bold transition hover:-rotate-1 hover:bg-sun">
              <PhoneIcon size={20} weight="bold" /> Call the shop
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
