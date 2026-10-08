/**
 * Store-wide settings. Everything a shop owner may want to change without
 * touching components lives here.
 */
export const site = {
  name: "Heritage Gift Wala",
  tagline: "Making a new gift",
  domain: "heritagegiftwala.in",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://heritagegiftwala.in",
  description:
    "Plush toys, crochet bouquets, gift hampers, tumblers, brass lamps, idols and a thousand tiny surprises — hand-picked and hand-wrapped at Heritage Gift Wala.",
  instagram: "heritagegiftwala",
  /** WhatsApp number with country code, digits only (e.g. 919876543210). Leave empty to hide the button. */
  whatsapp: "",
  email: "",
  /** From the shop's Google Maps listing. */
  phone: { display: "094086 00697", tel: "+919408600697" },
  address: {
    street: "University Rd, above Kabhi B Cake Shop",
    landmark: "Opp. Yash Plaza, College Road",
    city: "Patan",
    state: "Gujarat",
    pincode: "384265",
  },
  geo: { lat: 23.8561376, lng: 72.1300565 },
  googlePlaceId: "ChIJOzQSEgKHXDkRh_ofPsdUM6w",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=HERITAGE+GIFT+WALA&query_place_id=ChIJOzQSEgKHXDkRh_ofPsdUM6w",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=HERITAGE+GIFT+WALA&destination_place_id=ChIJOzQSEgKHXDkRh_ofPsdUM6w",
  /** The owner's "Embed a map" code from Google Maps, zoomed in to street level on the shop. */
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3000!2d72.13005649999999!3d23.8561376!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x395c87021212343b%3A0xac3354c73e1ffa87!2sHERITAGE%20GIFT%20WALA!5e0!3m2!1sen!2sin!4v1791408791097!5m2!1sen!2sin",
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
  giftWrapPrice: 49,
  dispatchTime: "Packed and dispatched within 1–2 working days",
  returnsNote:
    "As in our shop, goods once sold are not taken back. If something reaches you damaged, message us with an unboxing video and we will sort it out.",
  announcements: [
    "Every order is wrapped by hand at our shop",
    "Fix rate pricing — one fair price for everyone",
    "Custom hampers for birthdays, weddings and Diwali",
  ],
} as const;
