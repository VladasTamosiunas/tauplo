import { createHash, randomBytes } from "node:crypto";

/** A random session token for the cookie: 32 bytes, base64url (43 characters). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The database stores only this hash, so a leaked database cannot be used to sign in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
