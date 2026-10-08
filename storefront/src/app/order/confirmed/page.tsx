import type { Metadata } from "next";
import { OrderConfirmed } from "@/components/pages/OrderConfirmed";

export const metadata: Metadata = { title: "Order placed", robots: { index: false } };

export default function OrderConfirmedPage() {
  return <OrderConfirmed />;
}
