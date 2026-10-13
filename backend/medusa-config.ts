import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const isProd = process.env.NODE_ENV === "production";
const env = (name: string) => process.env[name]?.trim() || undefined;

if (isProd) {
  for (const name of ["DATABASE_URL", "JWT_SECRET", "COOKIE_SECRET", "STORE_CORS", "ADMIN_CORS", "AUTH_CORS"]) {
    if (!env(name)) throw new Error(`Missing required environment variable ${name}`);
  }
}

// Product photos uploaded from the admin panel need storage that survives redeploys
// (Render's disk is wiped on every deploy). Supabase Storage speaks the S3 protocol.
const s3 = env("S3_BUCKET")
  ? [
      {
        resolve: "@medusajs/medusa/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/file-s3",
              id: "s3",
              options: {
                file_url: env("S3_FILE_URL"),
                access_key_id: env("S3_ACCESS_KEY_ID"),
                secret_access_key: env("S3_SECRET_ACCESS_KEY"),
                region: env("S3_REGION"),
                bucket: env("S3_BUCKET"),
                endpoint: env("S3_ENDPOINT"),
                additional_client_config: { forcePathStyle: true },
              },
            },
          ],
        },
      },
    ]
  : [];

// Redis is optional: one Render instance runs fine on the in-memory defaults.
const redis = env("REDIS_URL")
  ? [
      { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl: env("REDIS_URL") } },
      { resolve: "@medusajs/medusa/workflow-engine-redis", options: { redis: { url: env("REDIS_URL") } } },
    ]
  : [];

module.exports = defineConfig({
  admin: {
    // The admin panel is served by this same service at /app.
    backendUrl: env("MEDUSA_BACKEND_URL"),
  },
  projectConfig: {
    databaseUrl: env("DATABASE_URL"),
    // Supabase and Render Postgres require TLS.
    databaseDriverOptions: isProd && env("DATABASE_SSL") !== "false" ? { connection: { ssl: { rejectUnauthorized: false } } } : {},
    http: {
      storeCors: env("STORE_CORS")!,
      adminCors: env("ADMIN_CORS")!,
      authCors: env("AUTH_CORS")!,
      jwtSecret: env("JWT_SECRET") || "supersecret",
      cookieSecret: env("COOKIE_SECRET") || "supersecret",
    },
  },
  modules: [...s3, ...redis],
});
