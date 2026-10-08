import type { CSSProperties } from "react";

export type Paper = { id: string; name: string; style: CSSProperties; dark?: boolean };
export type RibbonColour = { id: string; name: string; color: string };

const star = (fill: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M20 9l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L20 23.4 14.1 27l1.7-6.7-5.3-4.4 6.9-.5z' fill='${fill}'/></svg>`,
  )}")`;

/** Wrapping papers we keep at the counter. */
export const papers: Paper[] = [
  {
    id: "polka-lagoon",
    name: "Polka Lagoon",
    style: {
      backgroundColor: "#5adce3",
      backgroundImage: "radial-gradient(circle, #fff 3.2px, transparent 3.8px)",
      backgroundSize: "22px 22px",
    },
  },
  {
    id: "candy-stripe",
    name: "Candy Stripe",
    style: { backgroundImage: "repeating-linear-gradient(45deg, #ff8fb1 0 13px, #ffe4ec 13px 26px)" },
  },
  {
    id: "kraft-stars",
    name: "Kraft & Stars",
    style: { backgroundColor: "#c99b6d", backgroundImage: star("#fff6e6"), backgroundSize: "34px 34px" },
  },
  {
    id: "sunshine-confetti",
    name: "Sunshine Confetti",
    style: {
      backgroundColor: "#ffc93c",
      backgroundImage:
        "radial-gradient(circle at 20% 30%, #d72d4d 2.5px, transparent 3px), radial-gradient(circle at 70% 60%, #fff 3px, transparent 3.5px), radial-gradient(circle at 45% 85%, #12a7b3 2.5px, transparent 3px)",
      backgroundSize: "28px 28px, 36px 36px, 31px 31px",
    },
  },
  {
    id: "midnight-gold",
    name: "Midnight Gold",
    dark: true,
    style: { backgroundColor: "#1e1b2e", backgroundImage: star("#e0b04b"), backgroundSize: "30px 30px" },
  },
];

export const ribbons: RibbonColour[] = [
  { id: "red", name: "Red", color: "#d72d4d" },
  { id: "gold", name: "Gold", color: "#e0b04b" },
  { id: "pink", name: "Bubblegum", color: "#ff8fb1" },
  { id: "white", name: "Snow", color: "#ffffff" },
  { id: "mint", name: "Mint", color: "#7fd8c4" },
];

export const paperById = (id: string) => papers.find((p) => p.id === id) ?? papers[0];
export const ribbonById = (id: string) => ribbons.find((r) => r.id === id) ?? ribbons[0];
