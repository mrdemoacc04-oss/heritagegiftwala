import Link from "next/link";
import { Panda } from "@/components/brand/Panda";
import { ShopFrame } from "@/components/layout/ShopFrame";

export default function NotFound() {
  return (
    <ShopFrame>
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <Panda className="w-40" />
      <p className="mt-6 font-hand text-3xl text-ribbon">404, oops</p>
      <h1 className="mt-1 text-5xl leading-none font-extrabold">This page got lost in the wrapping paper</h1>
      <p className="mt-4 text-lg text-ink-2">We looked under every bow. Let&apos;s get you back to the good stuff.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-ink px-6 py-3 font-bold text-white hover:bg-ribbon">Back home</Link>
        <Link href="/shop" className="rounded-full border-2 border-ink px-6 py-3 font-bold hover:bg-sun">Shop all gifts</Link>
      </div>
    </div>
    </ShopFrame>
  );
}
