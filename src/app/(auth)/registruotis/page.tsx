import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Registruotis" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/profilis");
  return (
    <div className="mx-auto grid max-w-[520px] gap-6 px-4 py-14 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-4xl font-medium">Sukurkite paskyrą</h1>
        <p className="text-ink-2">Nemokama pradžia. Pasirinkite, kuo labiausiai pasinaudosite.</p>
      </div>
      <Card className="shadow-card">
        <RegisterForm />
      </Card>
      <p className="text-sm text-ink-2">
        Jau turite paskyrą?{" "}
        <Link href="/prisijungti" className="font-semibold text-ink underline">
          Prisijungti
        </Link>
      </p>
      <p className="text-sm text-ink-2">
        Atstovaujate organizacijai ir ieškote partnerystės?{" "}
        <Link href="/institucijoms" className="font-semibold text-ink underline">
          Užpildykite atskirą paraišką
        </Link>
        .
      </p>
    </div>
  );
}
