// Supabase's public root certificate ("Supabase Root 2021 CA", valid until 26 Apr 2031). It is NOT a secret:
// it only lets this app check that the database it reaches really is Supabase's. SHA-256 fingerprint:
//   80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
// Compare it with the certificate you can download in Supabase → Project Settings → Database → SSL Configuration.
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/**
 * How to reach Postgres securely. Shared by the app and the command-line scripts (so it imports nothing app-specific).
 *  - local databases: no TLS
 *  - Supabase: TLS with the connection VERIFIED against Supabase's own root certificate (built in), so nobody in
 *    between can impersonate the database
 *  - anything else: TLS verified against the normal system roots
 *  - DATABASE_SSL_CA overrides the certificate; DATABASE_SSL_VERIFY=false is an emergency switch (for example if
 *    Supabase ever replaces its root before this file is updated). It is loud on purpose.
 */
/**
 * The database address. DATABASE_URL is what this app is documented to use; the Vercel–Supabase integration instead
 * provides POSTGRES_URL (the same pooled connection), so that is accepted too.
 */
export const databaseUrl = (): string | undefined => process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || undefined;

/** Removes ssl-related options from a connection address, so nothing in it can switch off or weaken the checks below. */
export function cleanDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat", "supa"]) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return url;
  }
}

export function pgSsl(url: string): false | { ca?: string; rejectUnauthorized: boolean } {
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) return false;
  if (process.env.DATABASE_SSL_VERIFY === "false") {
    console.warn("[db] WARNING: database certificate checking is switched off (DATABASE_SSL_VERIFY=false).");
    return { rejectUnauthorized: false };
  }
  const custom = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  if (custom) return { ca: custom, rejectUnauthorized: true };
  if (/@[^/]*\.supabase\.(co|com)[:/]/.test(url)) return { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true };
  return { rejectUnauthorized: true };
}
