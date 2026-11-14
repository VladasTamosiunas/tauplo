/**
 * Development seed: one teacher, one demo classroom (code TK-DEMO) and four demo students,
 * enough for the classroom dashboard to show real numbers.
 * Run with: npm run db:seed. Refuses to run in production.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed is for development only.");

  const password = await hashPassword("demo-slaptazodis");
  const teacher = await db.user.upsert({
    where: { email: "mokytoja@tauplo.test" },
    update: {},
    create: { email: "mokytoja@tauplo.test", passwordHash: password, displayName: "Demo mokytoja", role: "TEACHER" },
  });
  const room = await db.classroom.upsert({
    where: { joinCode: "TK-DEMO" },
    update: {},
    create: { name: "Demo 10B klasė", kind: "CLASS", joinCode: "TK-DEMO", ownerId: teacher.id },
  });

  const students = [
    { name: "Aistė", handle: "aiste", xp: 340, iq: 72 },
    { name: "Benas", handle: "benas", xp: 520, iq: 81 },
    { name: "Gabija", handle: "gabija", xp: 210, iq: 58 },
    { name: "Dovydas", handle: "dovydas", xp: 90, iq: 49 },
  ];
  for (const s of students) {
    // Plain ASCII emails: the display name may contain Lithuanian letters, the login should not.
    const email = `${s.handle}@tauplo.test`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: password, displayName: s.name, role: "STUDENT", xp: s.xp, financialIq: s.iq },
    });
    await db.membership.upsert({
      where: { userId_classroomId: { userId: user.id, classroomId: room.id } },
      update: {},
      create: { userId: user.id, classroomId: room.id },
    });
  }
  console.log("Seeded. Teacher: mokytoja@tauplo.test, students: aiste/benas/gabija/dovydas@tauplo.test");
  console.log("Password for all: demo-slaptazodis. Classroom code: TK-DEMO");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
