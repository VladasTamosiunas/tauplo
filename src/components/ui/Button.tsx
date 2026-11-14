import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "light" | "quiet" | "danger";
type Size = "md" | "sm";

/*
  Buttons are small, squared and flat. Primary is solid ink on paper (white on black in dark mode),
  secondary is a hairline outline, and "quiet" is a text link with an arrow. No shadows, no glow.
*/
const base =
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-display font-semibold " +
  "transition-[background-color,color,transform,box-shadow] duration-200 ease-snap " +
  "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:opacity-85",
  ghost: "bg-transparent text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-surface-2",
  light: "bg-[#f7f6f3] text-[#17171a] hover:bg-white",
  quiet: "bg-transparent text-ink-2 hover:text-ink",
  danger: "bg-bad-ink text-white hover:opacity-90",
};

const sizes: Record<Size, { text: string; pad: string }> = {
  md: { text: "text-[15px]", pad: "px-5 py-3" },
  sm: { text: "text-[14px]", pad: "px-3.5 py-2" },
};

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode; arrow?: boolean };
type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

/** With `arrow`, a small diagonal arrow follows the label and moves a pixel on hover. */
export function Button({ variant = "primary", size = "md", className = "", arrow = false, children, ...props }: AsLink | AsButton) {
  const s = sizes[size];
  const pad = variant === "quiet" ? "px-1 py-2" : s.pad;
  const cls = `${base} ${variants[variant]} ${s.text} ${pad} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      {arrow ? (
        <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center transition-transform duration-200 ease-snap group-hover:-translate-y-px group-hover:translate-x-px">
          <span className="arrow" />
        </span>
      ) : null}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link className={cls} {...(props as Omit<AsLink, keyof Common>)}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...(props as Omit<AsButton, keyof Common>)}>
      {inner}
    </button>
  );
}

/** Same look as the buttons, for links that are real file downloads (a plain anchor, not a route). */
export function DownloadLink({ href, children, variant = "primary", size = "md" }: { href: string; children: ReactNode; variant?: Variant; size?: Size }) {
  const s = sizes[size];
  return (
    <a href={href} className={`${base} ${variants[variant]} ${s.text} ${s.pad}`}>
      <span>{children}</span>
      <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center transition-transform duration-200 ease-snap group-hover:translate-y-0.5">
        <span className="arrow rotate-[135deg]" />
      </span>
    </a>
  );
}
