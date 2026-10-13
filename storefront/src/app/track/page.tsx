import type { Metadata } from "next";
import { TrackOrder } from "@/components/pages/TrackOrder";

export const metadata: Metadata = {
  title: "Track your order",
  description: "See where your Heritage Gift Wala order is: packed, on its way or delivered.",
  alternates: { canonical: "/track" },
  robots: { index: false },
};

export default function TrackPage() {
  return <TrackOrder />;
}
