"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { joinClassroom } from "@/server/classrooms";

export type JoinState = { status: "idle" | "joined" | "error"; message?: string };

export async function joinClassAction(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Pirmiausia prisijunkite." };
  const code = fd.get("code");
  const result = await joinClassroom(user.id, typeof code === "string" ? code : "");
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/profilis");
  revalidatePath("/klase");
  return { status: "joined", message: `Prisijungei prie: ${result.classroomName}.` };
}
