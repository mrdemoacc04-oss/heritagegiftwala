"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
  }
}

/** Set NEXT_PUBLIC_TURNSTILE_SITE_KEY (and TURNSTILE_SECRET_KEY on the server) to switch the bot check on. */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Cloudflare Turnstile: usually invisible to real shoppers. Reports its answer through `onToken` ("" when it expires). */
export function Turnstile({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!turnstileSiteKey || !box.current) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.turnstile || !box.current || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: turnstileSiteKey,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    if (window.turnstile) {
      mount();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = undefined;
    };
  }, [onToken]);

  useEffect(() => {
    if (resetSignal && widget.current) {
      onToken("");
      window.turnstile?.reset(widget.current);
    }
  }, [resetSignal, onToken]);

  return turnstileSiteKey ? <div ref={box} className="mt-4 flex justify-center" /> : null;
}
