"use server";

import { submitInquiry } from "@/server/inquiries";

export type InquiryFormState = {
  status: "idle" | "error" | "sent";
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export async function submitInquiryAction(_prev: InquiryFormState, fd: FormData): Promise<InquiryFormState> {
  const values = {
    orgName: text(fd, "orgName"),
    projectType: text(fd, "projectType"),
    contactName: text(fd, "contactName"),
    email: text(fd, "email"),
    message: text(fd, "message"),
  };
  const result = await submitInquiry({
    ...values,
    consent: fd.get("consent") === "on",
    website: text(fd, "website"),
  });
  if (result.ok) return { status: "sent" };
  return { status: "error", errors: result.errors, values };
}
