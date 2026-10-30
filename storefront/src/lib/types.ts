export type Recipient = "her" | "him" | "kids" | "parents" | "colleague" | "home";
export type Occasion = "birthday" | "anniversary" | "festive" | "housewarming" | "thank-you" | "just-because";

export type Category = {
  handle: string;
  title: string;
  /** One-line pitch shown on collection pages and the mega menu. */
  blurb: string;
  /** Product handle whose cutout represents the category. */
  cover: string;
  tint: string;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  /** Price in whole rupees. null = no price shown: customers ask for it on WhatsApp. */
  price: number | null;
  compareAtPrice?: number;
  categories: string[];
  recipients: Recipient[];
  occasions: Occasion[];
  /** Transparent cutout, used on tinted tiles everywhere. */
  image: string;
  /** Clean studio shot on grey, second gallery frame. */
  studio?: string;
  /** The real photo from the shop shelf. */
  shelf?: string;
  tint: string;
  badge?: string;
  details: string[];
  /** "contain" for transparent cut-outs on the tinted tile; "cover" for ordinary photos that fill it. */
  imageFit: "contain" | "cover";
  inStock: boolean;
  /** Ordering weight for "Featured" sort and bestseller rails. */
  rank: number;
  isNew?: boolean;
  hidden?: boolean;
};

export type CartLine = {
  /** Local key for this line in the bag. */
  id: string;
  productId: string;
  handle: string;
  title: string;
  image: string;
  tint: string;
  /** null when the product has no price (the shop quotes it on WhatsApp). */
  price: number | null;
  quantity: number;
  /** How many page loads in a row did not find this product in the shop. A product is dropped only after a few, because one page can carry a slightly old copy of the catalog. */
  missed?: number;
};

/** The sale popup the owner edits in the control panel. Only a popup that is switched on, and not past its last day, reaches the shop. */
export type Popup = {
  label: string;
  title: string;
  text: string;
  buttonText: string;
  /** "", "whatsapp", a page on the shop ("/shop") or an https address. */
  buttonUrl: string;
  image: string;
  tint: string;
  /** Seconds on the page before it appears. */
  delay: number;
  /** Once closed, it stays away this many days. */
  reshowDays: number;
  /** The moment it stops showing (end of the owner's last day), or null for no end. */
  endsAt: string | null;
  /** Changes whenever the owner saves the popup, so people who closed an older one see the new one. */
  version: number;
};

/** Delivery fees and the sale popup, which the owner can change from the admin panel. */
export type ShopSettings = {
  shippingFlat: number;
  shippingExpress: number;
  /** Standard delivery is free from this subtotal; 0 switches the offer off. */
  freeShippingFrom: number;
  popup: Popup | null;
};
