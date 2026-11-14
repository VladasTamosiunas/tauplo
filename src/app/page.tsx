import { CoursesTeaser } from "@/components/landing/CoursesTeaser";
import { GamesTeaser } from "@/components/landing/GamesTeaser";
import { Hero } from "@/components/landing/Hero";
import { InstitutionsBand } from "@/components/landing/InstitutionsBand";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <>
      <Hero />
      <GamesTeaser signedIn={Boolean(user)} />
      <CoursesTeaser />
      <InstitutionsBand />
    </>
  );
}
