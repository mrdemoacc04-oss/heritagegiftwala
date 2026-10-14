import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Control panel", template: "%s · Control panel" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-stone-100 font-sans text-stone-900 antialiased">{children}</div>;
}
