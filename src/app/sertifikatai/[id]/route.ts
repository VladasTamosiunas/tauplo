import { getCurrentUser } from "@/lib/auth/session";
import { getCourse } from "@/lib/courses/catalog";
import { db } from "@/lib/db";
import { certificateFileName, renderCertificate } from "@/lib/pdf/certificate";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Sertifikato nerasta", { status: 404 });

/**
 * Downloads a certificate as PDF. Only the person it was issued to may download it;
 * everyone else (and guests) gets the same 404, so codes cannot be probed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return notFound();

  const cert = await db.certificate.findUnique({ where: { id }, include: { user: { select: { displayName: true } } } });
  if (!cert || cert.userId !== user.id) return notFound();

  const course = getCourse(cert.courseSlug);
  if (!course) return notFound();

  const input = { learnerName: cert.user.displayName, courseTitle: course.title, issuedAt: cert.issuedAt, code: cert.id };
  const bytes = await renderCertificate(input);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificateFileName(input)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
