import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L lookalikes, so codes survive being read aloud or copied from a screen. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Classroom or campaign join code, e.g. `TK-7Q42`. */
export function generateJoinCode(): string {
  return `TK-${randomCode(4)}`;
}

/** Public certificate code, e.g. `TS-4H7K2M9QXB`. */
export function generateCertificateId(): string {
  return `TS-${randomCode(10)}`;
}

/** Accepts `tk-7q42`, ` 7q42 ` or `TK-7Q42` and returns `TK-7Q42`. */
export function normalizeJoinCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("TK-") ? cleaned : `TK-${cleaned.replace(/^TK/, "")}`;
}
