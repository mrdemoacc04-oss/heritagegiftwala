import { formatPrice } from "./format";
import { site } from "./site";

export type OrderLine = { handle: string; title: string; quantity: number; price: number | null };

export type OrderDetails = {
  name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  note: string;
};

/** WhatsApp (and the phone's address bar) stop being reliable with very long links. Measured AFTER encoding, where a Gujarati letter takes 9 characters, so past this the product links are left out. */
const MAX_ENCODED = 4500;

/** A lone half of an emoji would make encodeURIComponent throw, so any such stray half becomes "�". */
const wellFormed = (s: string) => s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");

export const productUrl = (handle: string) => `${site.url}/products/${handle}`;

export const whatsappLink = (text: string) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(wellFormed(text))}`;

/**
 * The message the customer sends to the shop. Each product comes with its page address: WhatsApp turns the first one
 * into a card with the photo and name, and the shop can open the others to see exactly what was meant.
 */
export function orderMessage(lines: OrderLine[], d: OrderDetails): string {
  const build = (withLinks: boolean) => {
    const items = lines.map((l, i) => {
      const unit = l.price !== null ? ` (${formatPrice(l.price)} each)` : "";
      return `${i + 1}. *${l.title}* × ${l.quantity}${unit}${withLinks ? `\n${productUrl(l.handle)}` : ""}`;
    });
    const priced = lines.every((l) => l.price !== null);
    const total = priced ? lines.reduce((n, l) => n + (l.price ?? 0) * l.quantity, 0) : null;
    const address = [d.address1, d.address2, d.city, d.state].filter(Boolean).join(", ");
    return [
      `Hello ${site.name}! I'd like to order from your website:`,
      "",
      items.join(withLinks ? "\n\n" : "\n"),
      "",
      total !== null ? `Items total: ${formatPrice(total)}. Please confirm the delivery charge.` : "Please share the price and the delivery charge.",
      "",
      "*My details*",
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      `Address: ${address} - ${d.pincode}`,
      ...(d.note ? [`Note: ${d.note}`] : []),
      "",
      "Please confirm availability. Thank you!",
    ].join("\n");
  };
  const full = wellFormed(build(true));
  return encodeURIComponent(full).length > MAX_ENCODED ? wellFormed(build(false)) : full;
}
