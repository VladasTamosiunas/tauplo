"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Logo } from "./Logo";
import { UserPill } from "./UserPill";

export type NavUser = { displayName: string; xp: number; streak: number } | null;

const LINKS = [
  { href: "/zaidimai", label: "Žaidimai" },
  { href: "/kursai", label: "Kursai" },
  { href: "/skaiciuokle", label: "Skaičiuoklė" },
  { href: "/institucijoms", label: "Institucijoms" },
];

/**
 * Floating glass bar. On phones the menu opens as a full-screen sheet; the two lines of the
 * toggle turn into an X, and the links slide up one after another.
 * "Open" is derived from the path the menu was opened on, so any navigation closes it
 * without an effect that sets state.
 */
export function NavClient({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const toggle = toggleRef.current;
    document.documentElement.setAttribute("data-menu-open", "");
    // The panel is visibility:hidden until the next frame, and hidden elements cannot take focus.
    const focusFrame = requestAnimationFrame(() => panel?.querySelector<HTMLElement>("a[href]")?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenAt(null);
        toggle?.focus();
        return;
      }
      if (e.key !== "Tab" || !panel || !toggle) return;
      // keep Tab inside the open menu: the toggle, then every link and button in the sheet
      const ring = [toggle, ...Array.from(panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))];
      const at = ring.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (at <= 0)) {
        e.preventDefault();
        ring[ring.length - 1].focus();
      } else if (!e.shiftKey && (at === -1 || at === ring.length - 1)) {
        e.preventDefault();
        ring[0].focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
      document.documentElement.removeAttribute("data-menu-open");
    };
  }, [open]);

  const close = () => setOpenAt(null);
  const delay = (i: number) => ({ transitionDelay: open ? `${80 + i * 50}ms` : "0ms" });
  const reveal = (shown: boolean) => (shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0");

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[var(--z-nav)] border-b border-line bg-bg">
        <nav
          aria-label="Pagrindinė naršymo juosta"
          className="mx-auto flex h-16 max-w-[1120px] items-center gap-2 px-4 sm:px-6"
        >
          <Logo />
          <ul className="ml-6 hidden items-center gap-0.5 lg:flex">
            {LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block px-3 py-2 font-display text-[14.5px] font-medium underline-offset-[10px] transition-colors duration-200 ease-snap ${
                      active ? "text-ink underline decoration-1" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <UserPill xp={user.xp} streak={user.streak} />
                <Link
                  href="/profilis"
                  className="hidden px-3 py-2 font-display text-[14.5px] font-medium text-ink-2 transition-colors duration-200 ease-snap hover:text-ink xl:block"
                >
                  {user.displayName}
                </Link>
                <form action={logoutAction} className="hidden lg:block">
                  <Button variant="ghost" size="sm" type="submit">
                    Atsijungti
                  </Button>
                </form>
              </>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                <Button href="/prisijungti" variant="quiet" size="sm">
                  Prisijungti
                </Button>
                <Button href="/registruotis" size="sm">
                  Registruotis
                </Button>
              </div>
            )}

            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="mobilus-meniu"
              aria-label={open ? "Uždaryti meniu" : "Atidaryti meniu"}
              onClick={() => setOpenAt(open ? null : pathname)}
              className="relative size-10 shrink-0 rounded-md ring-1 ring-line-2 transition-[background-color,transform] duration-200 ease-snap hover:bg-surface-2 active:scale-95 lg:hidden"
            >
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-1/2 -ml-[9px] h-[1.5px] w-[18px] rounded-full bg-ink transition-transform duration-500 ease-snap ${
                  open ? "rotate-45" : "-translate-y-[4px]"
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-1/2 -ml-[9px] h-[1.5px] w-[18px] rounded-full bg-ink transition-transform duration-500 ease-snap ${
                  open ? "-rotate-45" : "translate-y-[4px]"
                }`}
              />
            </button>
          </div>
        </nav>
      </header>

      <div
        id="mobilus-meniu"
        ref={panelRef}
        data-open={open}
        aria-hidden={!open}
        className="invisible fixed inset-0 z-[var(--z-overlay)] bg-bg opacity-0 transition-[opacity,visibility] duration-300 ease-snap data-[open=true]:visible data-[open=true]:opacity-100 lg:hidden"
      >
        <div className="mx-auto flex h-full max-w-[1120px] flex-col justify-between gap-10 overflow-y-auto px-6 pb-10 pt-24">
          <ul className="grid gap-1">
            {LINKS.map((l, i) => (
              <li key={l.href} className="overflow-hidden">
                <Link
                  href={l.href}
                  onClick={close}
                  style={delay(i)}
                  className={`block border-b border-line py-4 font-serif text-[clamp(28px,8vw,40px)] font-medium leading-[1.1] tracking-[-0.015em] transition-[transform,opacity] duration-500 ease-snap ${reveal(open)}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={`grid gap-3 transition-[transform,opacity] duration-700 ease-snap ${reveal(open)}`} style={delay(LINKS.length)}>
            {user ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/profilis" onClick={close} className="text-lg font-semibold">
                    {user.displayName}
                  </Link>
                  <span className="flex items-center gap-1.5 [&_span]:inline-flex">
                    <UserPill xp={user.xp} streak={user.streak} />
                  </span>
                </div>
                <form action={logoutAction}>
                  <Button variant="ghost" type="submit" className="w-full">
                    Atsijungti
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Button href="/registruotis" className="w-full" onClick={close}>
                  Registruotis
                </Button>
                <Button href="/prisijungti" variant="ghost" className="w-full" onClick={close}>
                  Prisijungti
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
