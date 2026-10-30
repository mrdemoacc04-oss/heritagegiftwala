import Link from "next/link";
import { XIcon } from "@phosphor-icons/react/ssr";
import { site } from "@/lib/site";
import type { Popup } from "@/lib/types";

export type PopupContent = Pick<Popup, "label" | "title" | "text" | "buttonText" | "buttonUrl" | "image" | "tint">;

/** Where the popup's button goes. "whatsapp" opens a chat with the shop; a path stays on the site; an https address leaves it. */
export function popupHref(p: Pick<Popup, "buttonUrl" | "title">): string {
  if (p.buttonUrl === "whatsapp") return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`Hello ${site.name}! I saw "${p.title}" on your website.`)}`;
  return p.buttonUrl;
}

/**
 * The sale popup as a card. The shop shows it in a dialog; the control panel shows the same card as a live preview
 * (`preview`), where nothing is clickable.
 */
export function PopupCard({
  popup,
  onClose,
  onButton,
  preview,
  closeRef,
}: {
  popup: PopupContent;
  onClose?: () => void;
  onButton?: () => void;
  preview?: boolean;
  closeRef?: React.Ref<HTMLButtonElement>;
}) {
  const href = popupHref({ buttonUrl: popup.buttonUrl, title: popup.title });
  const external = /^https:\/\//.test(href);
  const button = "mt-6 flex h-14 w-full items-center justify-center rounded-full bg-ribbon px-6 text-lg font-bold text-white shadow-[0_6px_0_var(--color-ribbon-700)] transition hover:bg-ribbon-700 active:translate-y-1 active:shadow-[0_2px_0_var(--color-ribbon-700)]";

  return (
    <div className="relative w-full max-w-[440px] overflow-hidden rounded-[2rem] border-[3px] border-ink bg-paper text-left shadow-[8px_8px_0_var(--color-ink)]">
      {popup.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={popup.image} alt="" className="aspect-[16/9] w-full border-b-[3px] border-ink object-cover" referrerPolicy="no-referrer" />
      )}
      <div className="relative p-6 sm:p-8" style={{ background: popup.tint }}>
        <span aria-hidden className="dots absolute inset-0 opacity-40 [--dot-gap:20px]" />
        <div className="relative">
          {popup.label && (
            <span className="inline-block -rotate-3 rounded-full bg-ribbon px-3.5 py-1 font-display text-sm font-extrabold tracking-wider text-white uppercase shadow-[0_3px_0_var(--color-ribbon-700)]">
              {popup.label}
            </span>
          )}
          <h2 className="mt-3 text-[clamp(1.9rem,6vw,2.7rem)] leading-[0.98] font-extrabold" id={preview ? undefined : "promo-title"}>
            {popup.title || "Your heading"}
          </h2>
          {popup.text && <p className="mt-3 text-lg leading-snug whitespace-pre-line text-ink-2">{popup.text}</p>}
          {popup.buttonText && popup.buttonUrl && (
            preview ? (
              <span className={button}>{popup.buttonText}</span>
            ) : external ? (
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={onButton} className={button}>{popup.buttonText}</a>
            ) : (
              <Link href={href} onClick={onButton} className={button}>{popup.buttonText}</Link>
            )
          )}
          {!preview && (
            <button type="button" onClick={onClose} className="mx-auto mt-4 block text-sm font-bold text-ink-2 underline underline-offset-4 hover:text-ink">
              No thanks
            </button>
          )}
        </div>
      </div>
      {!preview && (
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full border-2 border-ink bg-white transition hover:rotate-90 hover:bg-ink hover:text-white"
        >
          <XIcon size={18} weight="bold" />
        </button>
      )}
    </div>
  );
}
