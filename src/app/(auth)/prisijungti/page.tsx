import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Prisijungti" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/profilis");
  return (
    <div className="mx-auto grid max-w-[460px] gap-6 px-4 py-14 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-4xl font-medium">Sveiki sugrįžę</h1>
        <p className="text-ink-2">Prisijunkite ir tęskite nuo ten, kur sustojote.</p>
      </div>
      <Card className="shadow-card">
        <LoginForm />
      </Card>
      <p className="text-sm text-ink-2">
        Dar neturite paskyros?{" "}
        <Link href="/registruotis" className="font-semibold text-ink underline">
          Registruotis
        </Link>
      </p>
    </div>
  );
}
