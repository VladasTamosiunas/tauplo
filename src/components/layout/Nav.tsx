import { getCurrentUser } from "@/lib/auth/session";
import { NavClient } from "./NavClient";

export async function Nav() {
  const user = await getCurrentUser();
  return <NavClient user={user ? { displayName: user.displayName, xp: user.xp, streak: user.streakCount } : null} />;
}
