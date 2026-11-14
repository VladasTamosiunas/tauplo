import { z } from "zod";
import { db } from "@/lib/db";

export const PROJECT_TYPES = [
  { value: "SCHOOL_MUNICIPALITY", label: "Mokyklų ar savivaldybės programa" },
  { value: "COBRANDED_MODULE", label: "Bendro prekės ženklo edukacinis modulis" },
  { value: "EU_STATE_PROGRAM", label: "ES ar valstybės finansuojamas projektas" },
  { value: "OTHER", label: "Kita" },
] as const;

const text = (min: number, max: number, minMsg: string, maxMsg: string) =>
  z.string({ error: minMsg }).trim().min(min, minMsg).max(max, maxMsg);

export const InquirySchema = z.object({
  orgName: text(2, 200, "Įveskite organizacijos pavadinimą.", "Pavadinimas per ilgas (iki 200 simbolių)."),
  projectType: z.enum(["SCHOOL_MUNICIPALITY", "COBRANDED_MODULE", "EU_STATE_PROGRAM", "OTHER"], { error: "Pasirinkite projekto tipą." }),
  contactName: text(2, 120, "Įveskite kontaktinio asmens vardą.", "Vardas per ilgas (iki 120 simbolių)."),
  email: z
    .string({ error: "Įveskite galiojantį el. pašto adresą." })
    .trim()
    .toLowerCase()
    .max(254, "El. paštas per ilgas.")
    .pipe(z.email("Įveskite galiojantį el. pašto adresą.")),
  message: z
    .string()
    .trim()
    .max(2000, "Žinutė per ilga (iki 2000 simbolių).")
    .optional()
    .transform((m) => (m ? m : undefined)),
  consent: z.literal(true, { error: "Pažymėkite sutikimą, kad galėtume susisiekti." }),
});

export type InquiryResult = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * Stores a partnership inquiry from an organisation. This is deliberately separate from
 * learner sign-up. A filled `website` field is a hidden honeypot only bots complete:
 * those get a normal-looking success and nothing is stored.
 */
export async function submitInquiry(input: unknown): Promise<InquiryResult> {
  if (!input || typeof input !== "object") return { ok: false, errors: { form: "Neteisingi duomenys." } };
  const website = (input as { website?: unknown }).website;
  if (typeof website === "string" && website.trim() !== "") return { ok: true };

  const parsed = InquirySchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  const { orgName, projectType, contactName, email, message, consent } = parsed.data;
  await db.inquiry.create({ data: { orgName, projectType, contactName, email, message, consent } });
  return { ok: true };
}
