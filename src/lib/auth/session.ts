// Uses Web Crypto (globalThis.crypto.subtle) rather than node:crypto so the
// exact same signing code runs in both the Edge middleware and normal Node
// route handlers/server components.

export type SessionPayload = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "rep";
};

export const SESSION_COOKIE = "coldcall_session";

// A dev-only fallback so the app works out of the box locally — but this
// value is public (it's in the repo), so anyone could forge an admin session
// with it. Never allow it in production: fail loudly instead of silently
// running with a known secret.
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET environment variable must be set in production.");
}
const SECRET = process.env.AUTH_SECRET ?? "coldcall-dev-secret-change-me";

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(padded + "===".slice((padded.length + 3) % 4));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(SECRET);
  return crypto.subtle.importKey("raw", enc, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sig).slice().buffer,
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch {
    return null;
  }
}
