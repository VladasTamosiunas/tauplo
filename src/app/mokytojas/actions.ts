"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClassroom } from "@/server/classrooms";

export type CreateRoomState = { error?: string; name?: string };

export async function createClassroomAction(_prev: CreateRoomState, fd: FormData): Promise<CreateRoomState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "TEACHER") return { error: "Klases gali kurti tik mokytojai ir institucijų atstovai." };
  const raw = fd.get("name");
  const name = typeof raw === "string" ? raw : "";
  const kind = fd.get("kind") === "CAMPAIGN" ? "CAMPAIGN" : "CLASS";
  if (name.trim().length === 0) return { error: "Įveskite pavadinimą.", name };
  if (name.trim().length > 80) return { error: "Pavadinimas per ilgas (iki 80 simbolių).", name };
  const room = await createClassroom(user.id, { name, kind });
  revalidatePath("/mokytojas");
  redirect(`/mokytojas/${room.id}`);
}
