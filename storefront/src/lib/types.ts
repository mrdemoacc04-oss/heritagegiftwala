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
  /** Price in rupees (whole rupees). */
  price: number;
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

export type WrapChoice = {
  paper: string;
  ribbon: string;
  note: string;
};

export type CartLine = {
  /** Local key for this line in the bag. */
  id: string;
  productId: string;
  handle: string;
  title: string;
  image: string;
  tint: string;
  price: number;
  quantity: number;
  wrap?: WrapChoice;
};

/** Delivery fees the owner can change from the admin panel. */
export type ShopSettings = {
  shippingFlat: number;
  shippingExpress: number;
  /** Standard delivery is free from this subtotal; 0 switches the offer off. */
  freeShippingFrom: number;
};
