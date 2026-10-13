import type { Metadata } from "next";
import { AccountHome } from "@/components/account/AccountHome";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return <AccountHome />;
}
