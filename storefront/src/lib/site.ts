/**
 * Store-wide settings. Everything a shop owner may want to change without
 * touching components lives here.
 */
const mapQuery = encodeURIComponent("Shlok Plaza, Rajmahel Road, Patan, Gujarat 384265");

export const site = {
  name: "Heritage Gift Wala",
  tagline: "Making a new gift",
  domain: "heritagegiftwala.in",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://heritagegiftwala.in",
  description:
    "Plush toys, crochet bouquets, gift hampers, tumblers, brass lamps, idols and a thousand tiny surprises — hand-picked and hand-wrapped at Heritage Gift Wala.",
  instagram: "heritagegiftwala",
  /** Where "Buy on WhatsApp" sends customers: country code + number, digits only. Leave empty to hide every WhatsApp button. */
  whatsapp: "919408600697",
  email: "",
  phone: { display: "094086 00697", tel: "+919408600697" },
  address: {
    street: "G-1/2, Shlok Plaza, Rajmahel Road",
    /** The part of the address that fits on a button or a heading. */
    place: "Shlok Plaza, Rajmahel Road",
    landmark: "Opp. Yash Plaza",
    city: "Patan",
    state: "Gujarat",
    pincode: "384265",
  },
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
  directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`,
  /** Google's key-free embed, found by address so it follows this address, not a saved pin. */
  mapEmbedUrl: `https://www.google.com/maps?q=${mapQuery}&z=17&output=embed`,
  /** The shop front, on the map card and in "come say hi". */
  storePhoto: { src: "/shop/store-front.jpg", width: 1600, height: 900 },
  /** Shown as a link to the live Google reviews; update the numbers now and then. */
  googleRating: {
    score: 4.5,
    count: 37,
    url: "https://search.google.com/local/reviews?placeid=ChIJOzQSEgKHXDkRh_ofPsdUM6w",
  },
  currency: "INR",
  /** Orders at or above this subtotal ship free. Set to 0 to hide the meter. */
  freeShippingThreshold: 999,
  shippingFlat: 79,
  expressShipping: 149,
  dispatchTime: "Packed and dispatched within 1–2 working days",
  returnsNote:
    "As in our shop, goods once sold are not taken back. If something reaches you damaged, message us with an unboxing video and we will sort it out.",
  announcements: [
    "Every order is wrapped by hand at our shop",
    "Fix rate pricing — one fair price for everyone",
    "Custom hampers for birthdays, weddings and Diwali",
    "Pick your gifts, tap Buy, and we confirm everything on WhatsApp",
  ],
} as const;
