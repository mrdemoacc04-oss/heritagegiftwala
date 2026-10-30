import type { Metadata } from "next";
import { InstagramLogoIcon, WhatsappLogoIcon, EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react/ssr";
import { ShopMap } from "@/components/brand/ShopMap";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Help", description: "Delivery, returns and how to reach Heritage Gift Wala.", alternates: { canonical: "/help" } };

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 pb-10 sm:px-6">
      <p className="font-hand text-3xl text-ribbon">here to help</p>
      <h1 className="mt-1 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95] font-extrabold">Good to know</h1>

      <section id="delivery" className="mt-12 scroll-mt-28 rounded-[2rem] bg-white p-7">
        <h2 className="text-3xl font-extrabold">Delivery</h2>
        <p className="mt-3 text-lg text-ink-2">{site.dispatchTime}. Standard delivery usually takes 3–6 working days across India.</p>
        <p className="mt-2 text-lg text-ink-2">
          We confirm the price and the delivery charge with you on WhatsApp before anything is sent. You can also pick your order up from our shop in {site.address.city}.
        </p>
      </section>

      <section id="returns" className="mt-6 scroll-mt-28 rounded-[2rem] bg-white p-7">
        <h2 className="text-3xl font-extrabold">Returns</h2>
        <p className="mt-3 text-lg text-ink-2">{site.returnsNote}</p>
      </section>

      <section id="contact" className="mt-6 scroll-mt-28 rounded-[2rem] bg-lagoon p-7">
        <h2 className="text-3xl font-extrabold">Say hello</h2>
        <p className="mt-3 text-lg">Questions about a gift, a custom hamper or an order? WhatsApp is the quickest way to reach us.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`https://instagram.com/${site.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-bold text-white hover:bg-ribbon">
            <InstagramLogoIcon size={20} /> @{site.instagram}
          </a>
          {site.whatsapp && (
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-bold text-white hover:bg-[#25d366]">
              <WhatsappLogoIcon size={20} /> Chat on WhatsApp
            </a>
          )}
          {site.email && (
            <a href={`mailto:${site.email}`} className="flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-bold text-white hover:bg-ribbon">
              <EnvelopeSimpleIcon size={20} /> {site.email}
            </a>
          )}
          <a href={`tel:${site.phone.tel}`} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold hover:bg-sun">
            <PhoneIcon size={20} /> {site.phone.display}
          </a>
        </div>
      </section>

      <ShopMap className="mt-16" />
    </div>
  );
}
