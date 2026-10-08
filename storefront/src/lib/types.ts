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
  /** Price in rupees (Medusa v2 stores major units). */
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
  /** Medusa variant to add to cart. Absent in preview mode. */
  variantId?: string;
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
  /** Local key — the Medusa line item id once synced. */
  id: string;
  productId: string;
  handle: string;
  title: string;
  image: string;
  tint: string;
  price: number;
  quantity: number;
  variantId?: string;
  wrap?: WrapChoice;
};
