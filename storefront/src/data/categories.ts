import type { Category } from "@/lib/types";

/** Collections, named after the shelves in the shop. Mirrors Medusa product categories by handle. */
export const categories: Category[] = [
  { handle: "gift-hampers", title: "Gift Hampers", blurb: "Ready-to-gift bundles and boxes, bowed and done.", cover: "hamper-just-for-you", tint: "#FFD6DE" },
  { handle: "soft-toys", title: "Soft Toys", blurb: "Squishy, huggable and impossible to put down.", cover: "plush-sunflower-bunny", tint: "#FFE0EC" },
  { handle: "crochet", title: "Crochet Love", blurb: "Hand-crocheted flowers and charms that never wilt.", cover: "bouquet-crochet-sunflower", tint: "#D3F3EA" },
  { handle: "flowers", title: "Flower Pots", blurb: "Forever-fresh blooms for desks, shelves and sweethearts.", cover: "pot-love-basket", tint: "#FFE3CC" },
  { handle: "sippers", title: "Tumblers & Cups", blurb: "Big-sip tumblers, cute cups and bottles for every bag.", cover: "tumbler-butterfly", tint: "#E6DEFF" },
  { handle: "home-decor", title: "Home Décor", blurb: "Showpieces, wall art and shiny things for the home.", cover: "showpiece-gold-yoga", tint: "#F4E9D8" },
  { handle: "lamps-clocks", title: "Lamps & Clocks", blurb: "Warm little lights and clocks with moving gears.", cover: "clock-ivory-gear", tint: "#D6EEFF" },
  { handle: "accessories", title: "Bags & Accessories", blurb: "Handbags, totes, caps, pendants and perfume.", cover: "bag-caramel-slouch", tint: "#F7E4D4" },
  { handle: "divine", title: "Divine Idols", blurb: "Hand-painted idols for the mandir and festive gifting.", cover: "idol-krishna-flute", tint: "#FFE9B8" },
  { handle: "kids", title: "Kids' Corner", blurb: "Lunch boxes, lamps and plushies for tiny bosses.", cover: "kids-dino-box", tint: "#FFF0A8" },
  { handle: "office", title: "Desk & Office", blurb: "Smart desk pieces for the boss, the team and the topper.", cover: "office-perpetual-calendar", tint: "#E1E7F0" },
];
