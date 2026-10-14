import { ShopFrame } from "@/components/layout/ShopFrame";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopFrame>{children}</ShopFrame>;
}
