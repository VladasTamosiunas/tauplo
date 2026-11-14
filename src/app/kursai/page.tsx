import type { Metadata } from "next";
import { CourseGrid } from "@/components/courses/CourseGrid";
import { getCourses } from "@/lib/courses/catalog";

export const metadata: Metadata = {
  title: "Kursai",
  description: "Struktūruoti finansinio raštingumo kursai moksleiviams, suaugusiems ir savarankiškai dirbantiems.",
};

export default function CoursesPage() {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-14 sm:px-6">
      <div className="grid max-w-[62ch] gap-3">
        <h1 className="text-[clamp(32px,4.2vw,48px)] font-medium leading-[1.1]">Struktūruoti kursai</h1>
        <p className="text-[17px] text-ink-2">
          Trumpos pamokos ir baigiamasis testas. Pasirink pagal savo gyvenimo etapą, peržiūrėk programą ir pradėk.
        </p>
      </div>
      <CourseGrid courses={getCourses()} />
    </div>
  );
}
