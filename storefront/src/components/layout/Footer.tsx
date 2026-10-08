import Image from "next/image";
import Link from "next/link";
import { InstagramLogoIcon, MapPinIcon, PhoneIcon, WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import { Panda } from "@/components/brand/Panda";
import { Ribbon } from "@/components/ui/Ribbon";
import { site } from "@/lib/site";
import type { Category } from "@/lib/types";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="relative mt-32">
      {/* the panda hangs over the edge, watching your cursor */}
      <div className="pointer-events-none absolute -top-[86px] left-[8%] z-10 w-36 sm:left-[12%] sm:w-44">
        <Panda pose="peek" className="w-full" title="The Heritage Gift Wala panda" />
      </div>

      <div className="relative overflow-hidden rounded-t-[3rem] bg-lagoon text-ink sm:rounded-t-[4.5rem]">
        <div className="dots absolute inset-0 opacity-45 [--dot-gap:22px]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1400px] gap-12 px-6 pt-20 pb-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image src="/brand/logo.png" alt="Heritage Gift Wala" width={150} height={146} className="w-32 drop-shadow-[0_10px_20px_rgb(30_27_46/0.2)]" />
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-ink/80">{site.description}</p>
            <address className="mt-4 max-w-xs text-[15px] leading-relaxed font-semibold not-italic">
              {site.address.street}, {site.address.landmark}, {site.address.city}, {site.address.state} {site.address.pincode}
              <a href={`tel:${site.phone.tel}`} className="mt-1 flex items-center gap-1.5 hover:text-ribbon-700">
                <PhoneIcon size={16} weight="fill" /> {site.phone.display}
              </a>
            </address>
            <div className="mt-5 flex gap-2">
              <a
                href={`https://instagram.com/${site.instagram}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid size-11 place-items-center rounded-full bg-ink text-white transition hover:-rotate-12 hover:bg-ribbon"
              >
                <InstagramLogoIcon size={22} />
              </a>
              {site.whatsapp && (
                <a
                  href={`https://wa.me/${site.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="grid size-11 place-items-center rounded-full bg-ink text-white transition hover:-rotate-12 hover:bg-[#25d366]"
                >
                  <WhatsappLogoIcon size={22} />
                </a>
              )}
              <a
                href={site.directionsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Directions to the shop on Google Maps"
                className="grid size-11 place-items-center rounded-full bg-ink text-white transition hover:-rotate-12 hover:bg-sun hover:text-ink"
              >
                <MapPinIcon size={22} />
              </a>
            </div>
          </div>

          <FooterCol title="Shelves">
            {categories.slice(0, 7).map((c) => (
              <FooterLink key={c.handle} href={`/collections/${c.handle}`}>
                {c.title}
              </FooterLink>
            ))}
          </FooterCol>
          <FooterCol title="Gifting">
            <FooterLink href="/gift-finder">Gift Finder</FooterLink>
            <FooterLink href="/#wrap-studio">Wrap Studio</FooterLink>
            <FooterLink href="/#hamper-builder">Build a Hamper</FooterLink>
            <FooterLink href="/shop?max=500">Gifts under ₹500</FooterLink>
            <FooterLink href="/wishlist">Your wishlist</FooterLink>
          </FooterCol>
          <FooterCol title="Help">
            <FooterLink href="/help#delivery">Delivery</FooterLink>
            <FooterLink href="/help#returns">Returns</FooterLink>
            <FooterLink href="/help#contact">Contact us</FooterLink>
            <FooterLink href="/#visit">Visit the shop</FooterLink>
          </FooterCol>
        </div>

        <div className="relative mx-auto max-w-[1400px] px-6">
          <Ribbon className="ml-4">{site.tagline}</Ribbon>
        </div>
        <p
          aria-hidden
          className="relative -mb-[0.2em] select-none whitespace-nowrap text-center font-display text-[17.5vw] leading-[0.85] font-extrabold tracking-[-0.06em] text-ink lg:text-[15.5vw]"
        >
          giftwala
        </p>
        <div className="footer-bottom relative border-t-2 border-dashed border-ink/25 bg-ink text-white/70">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-6 py-4 text-sm sm:flex-row">
            <span>
              © {new Date().getFullYear()} {site.name} · {site.domain}
            </span>
            <span className="font-hand text-lg text-sun">wrapped by hand, with love, in {site.address.city}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold tracking-[0.16em] uppercase">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="inline-block font-semibold transition hover:translate-x-1 hover:text-ribbon-700">
        {children}
      </Link>
    </li>
  );
}
