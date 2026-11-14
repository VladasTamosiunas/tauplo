import type { ReactNode } from "react";

/** A plain panel: white on paper, a 1 px hairline, a 10 px corner, no shadow. */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={`min-w-0 rounded-[10px] bg-surface p-6 shadow-[0_0_0_1px_var(--line)] sm:p-8 ${className}`}>{children}</Tag>;
}

/** The one object a section is about (a calculator, a game). Same hairline panel as Card, so it is not dressed up. */
export function Bezel({ children, className = "", coreClassName = "" }: { children: ReactNode; className?: string; coreClassName?: string }) {
  return (
    <div className={`bezel min-w-0 ${className}`}>
      <div className={`bezel-core h-full ${coreClassName}`}>{children}</div>
    </div>
  );
}

export function SectionHeading({ title, lead, className = "" }: { title: string; lead?: string; className?: string }) {
  return (
    <div className={`grid max-w-[60ch] gap-3 ${className}`}>
      <h2 className="text-[clamp(28px,3.4vw,40px)] font-medium leading-[1.12]">{title}</h2>
      {lead ? <p className="max-w-[52ch] text-[17px] text-ink-2">{lead}</p> : null}
    </div>
  );
}
