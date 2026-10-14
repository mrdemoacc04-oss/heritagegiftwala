import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPage } from "@/components/account/AuthPage";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return (
    <Suspense>
      <AuthPage initialMode="login" />
    </Suspense>
  );
}
