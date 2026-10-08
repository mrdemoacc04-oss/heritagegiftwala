import Medusa from "@medusajs/js-sdk";

const baseUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export const regionId = process.env.NEXT_PUBLIC_MEDUSA_REGION_ID ?? "";

/** True once the storefront is pointed at a live Medusa backend. */
export const medusaEnabled = Boolean(baseUrl && publishableKey && regionId);

export const sdk = medusaEnabled ? new Medusa({ baseUrl, publishableKey, debug: false }) : null;
