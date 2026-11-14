import type { Metadata } from "next";
import { Bezel } from "@/components/ui/Card";
import { CompoundCalculator } from "@/components/calculator/CompoundCalculator";
import { CushionPlanner } from "@/components/calculator/CushionPlanner";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Skaičiuoklė",
  description: "Penkerių metų taupymo skaičiuoklė ir pagalvės nenumatytoms išlaidoms planuoklis.",
};

export default async function CalculatorPage() {
  const user = await getCurrentUser();
  const plan = user
    ? await db.cushionPlan.findUnique({
        where: { userId: user.id },
        select: { monthlyExpenses: true, currentSavings: true, monthlySaving: true, months: true },
      })
    : null;

  return (
    <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-14 sm:px-6">
      <div className="grid max-w-[62ch] gap-3">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Skaičiuoklės</h1>
        <p className="text-[17px] text-ink-2">Pamatyk, kaip nedidelis kasmėnesinis įprotis auga per penkerius metus, ir suplanuok savo atsargų pagalvę.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="rise" style={{ ["--d" as string]: 2 }}>
          <Bezel>
            <CompoundCalculator />
          </Bezel>
        </div>
        <div className="rise lg:mt-16" style={{ ["--d" as string]: 3 }}>
          <Bezel>
            <CushionPlanner signedIn={Boolean(user)} initial={plan} />
          </Bezel>
        </div>
      </div>
    </div>
  );
}
