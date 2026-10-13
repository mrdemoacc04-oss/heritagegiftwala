import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  createUsersWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { catalog } from "./data/catalog";

/**
 * Runs on every deploy, before the server starts, and is safe to repeat.
 *
 *  1. Creates the shop owner's admin login from ADMIN_EMAIL / ADMIN_PASSWORD (only if that email has no login yet).
 *  2. Sets the shop up ONCE (India region, INR, Patan stock location, delivery options, categories, the catalog
 *     and an API key for the storefront). After that it leaves everything alone, so edits made in the admin
 *     panel (prices, stock, deleted products) are never overwritten by a redeploy.
 *
 * Re-run the shop setup from scratch by clearing `catalog_seeded` in the store's metadata.
 */

const STARTING_STOCK = Number(process.env.STARTING_STOCK ?? 10);
const FREE_DELIVERY_FROM = Number(process.env.FREE_DELIVERY_FROM ?? 999);
const STANDARD_DELIVERY = Number(process.env.STANDARD_DELIVERY ?? 79);
const EXPRESS_DELIVERY = Number(process.env.EXPRESS_DELIVERY ?? 149);
// Product photos live in the storefront's /public/products folder; the catalog stores them as site-relative paths.
const IMAGE_BASE = (process.env.STOREFRONT_URL ?? "https://heritagegiftwala.in").replace(/\/+$/, "");

export default async function bootstrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  await ensureAdminUser(container, logger);
  await ensureShop(container, logger);
}

type Container = ExecArgs["container"];
type Logger = { info: (m: string) => void; warn: (m: string) => void };

async function ensureAdminUser(container: Container, logger: Logger) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    logger.info("ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin login creation.");
    return;
  }
  const userModule = container.resolve(Modules.USER);
  const authModule = container.resolve(Modules.AUTH);

  const existing = await userModule.listUsers({ email });
  if (existing.length) {
    logger.info(`Admin login for ${email} already exists.`);
    return;
  }

  const { result: users } = await createUsersWorkflow(container).run({ input: { users: [{ email }] } });
  const { authIdentity, error } = await authModule.register("emailpass", { body: { email, password } });
  if (error || !authIdentity) throw new Error(`Could not create the admin login: ${error ?? "unknown error"}`);
  await authModule.updateAuthIdentities({ id: authIdentity.id, app_metadata: { user_id: users[0].id } });
  logger.info(`Created admin login for ${email}.`);
}

async function ensureShop(container: Container, logger: Logger) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const storeModule = container.resolve(Modules.STORE);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);

  const [store] = await storeModule.listStores();
  if (store.metadata?.catalog_seeded) {
    logger.info("Shop already set up, leaving the catalog alone.");
    await printStorefrontKeys(container, logger);
    return;
  }

  logger.info("Setting up Heritage Gift Wala for the first time…");

  // Sales channel ----------------------------------------------------------------
  // Medusa creates a "Default Sales Channel" and a publishable key linked to it on first boot; reuse both
  // (a key must point at exactly one channel for stock levels to show up on the storefront).
  let [salesChannel] = await salesChannelModule.listSalesChannels({}, { order: { created_at: "ASC" }, take: 1 });
  if (salesChannel) {
    salesChannel = await salesChannelModule.updateSalesChannels(salesChannel.id, {
      name: "Heritage Gift Wala Online",
      description: "heritagegiftwala.in",
    });
  } else {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Heritage Gift Wala Online", description: "heritagegiftwala.in" }] },
    });
    salesChannel = result[0];
  }

  // Store: INR only ----------------------------------------------------------------
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Heritage Gift Wala",
        supported_currencies: [{ currency_code: "inr", is_default: true }],
        default_sales_channel_id: salesChannel.id,
      },
    },
  });

  // Region: India, cash on delivery (the built-in "system default" provider) ---------
  const { result: regions } = await createRegionsWorkflow(container).run({
    input: { regions: [{ name: "India", currency_code: "inr", countries: ["in"], payment_providers: ["pp_system_default"] }] },
  });
  const region = regions[0];

  await createTaxRegionsWorkflow(container).run({ input: [{ country_code: "in", provider_id: "tp_system" }] });

  // Stock location: the shop in Patan ---------------------------------------------
  const { result: locations } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "Heritage Gift Wala, Patan",
          address: {
            address_1: "University Rd, above Kabhi B Cake Shop",
            city: "Patan",
            province: "Gujarat",
            postal_code: "384265",
            country_code: "IN",
          },
        },
      ],
    },
  });
  const location = locations[0];
  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_location_id: location.id } },
  });
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });
  await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [salesChannel.id] } });

  // Delivery ---------------------------------------------------------------------
  let [shippingProfile] = await fulfillmentModule.listShippingProfiles({ type: "default" });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    });
    shippingProfile = result[0];
  }

  const fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
    name: "Heritage Gift Wala delivery",
    type: "shipping",
    service_zones: [{ name: "India", geo_zones: [{ country_code: "in", type: "country" }] }],
  });
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  const storefrontRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ];
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Standard", description: "3–6 working days", code: "standard" },
        prices: [
          { currency_code: "inr", amount: STANDARD_DELIVERY },
          ...(FREE_DELIVERY_FROM > 0
            ? [{ currency_code: "inr", amount: 0, rules: [{ attribute: "item_total", operator: "gte" as const, value: FREE_DELIVERY_FROM }] }]
            : []),
        ],
        rules: storefrontRules,
      },
      {
        name: "Express delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Express", description: "1–3 working days", code: "express" },
        prices: [{ currency_code: "inr", amount: EXPRESS_DELIVERY }],
        rules: storefrontRules,
      },
    ],
  });

  // Storefront API key -----------------------------------------------------------
  const { data: keys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "sales_channels.id"],
    filters: { type: "publishable" },
  });
  let publishable = keys[0];
  if (!publishable) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "" }] },
    });
    publishable = result[0] as unknown as typeof publishable;
  }
  if (!publishable.sales_channels?.some((c) => c?.id === salesChannel.id)) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: publishable.id, add: [salesChannel.id] } });
  }

  // Categories + products ---------------------------------------------------------
  const { result: categories } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: catalog.categories.map((c) => ({
        name: c.name,
        handle: c.handle,
        description: c.description,
        is_active: true,
        metadata: { tint: c.tint, cover: c.cover },
      })),
    },
  });
  const categoryId = new Map(categories.map((c) => [c.handle, c.id]));

  const toUrl = (src: string) => `${IMAGE_BASE}${src}`;
  await createProductsWorkflow(container).run({
    input: {
      products: catalog.products.map((p) => ({
        title: p.title,
        subtitle: p.subtitle,
        handle: p.handle,
        description: p.description,
        status: ProductStatus.PUBLISHED,
        category_ids: p.categories.map((h) => categoryId.get(h)!).filter(Boolean),
        shipping_profile_id: shippingProfile.id,
        sales_channels: [{ id: salesChannel.id }],
        thumbnail: p.images[0] ? toUrl(p.images[0]) : undefined,
        images: p.images.map((src) => ({ url: toUrl(src) })),
        metadata: p.metadata,
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: p.handle,
            manage_inventory: p.managed,
            allow_backorder: false,
            options: { Default: "Default" },
            prices: [{ currency_code: "inr", amount: p.price }],
          },
        ],
      })),
    },
  });

  // Opening stock ----------------------------------------------------------------
  const { data: items } = await query.graph({ entity: "inventory_item", fields: ["id", "sku"] });
  const managedSkus = new Set<string>(catalog.products.filter((p) => p.managed).map((p) => p.handle));
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: items
        .filter((i) => i.sku && managedSkus.has(i.sku))
        .map((i) => ({ inventory_item_id: i.id, location_id: location.id, stocked_quantity: STARTING_STOCK })),
    },
  });

  await storeModule.updateStores(store.id, { metadata: { ...store.metadata, catalog_seeded: true } });

  await printStorefrontKeys(container, logger);
}

async function printStorefrontKeys(container: Container, logger: Logger) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "name"] });
  const { data: keys } = await query.graph({ entity: "api_key", fields: ["token"], filters: { type: "publishable" } });
  logger.info("──────────────────────────────────────────────────────────────");
  logger.info(`NEXT_PUBLIC_MEDUSA_REGION_ID          = ${regions.find((r) => r.name === "India")?.id ?? regions[0]?.id}`);
  logger.info(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY    = ${keys[0]?.token}`);
  logger.info("Put both in the storefront's environment variables (they are not secret).");
  logger.info("──────────────────────────────────────────────────────────────");
}
