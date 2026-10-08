import type { Metadata } from "next";
import { GiftFinder } from "@/components/gifting/GiftFinder";

export const metadata: Metadata = {
  title: "Gift Finder",
  description: "Three quick questions and we'll pick the perfect gift off our shelves.",
  alternates: { canonical: "/gift-finder" },
};

export default function GiftFinderPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-10 sm:px-6">
      <GiftFinder variant="page" />
    </div>
  );
}
