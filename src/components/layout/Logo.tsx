import Link from "next/link";

/** A plain serif wordmark. The amber stop after it is the only ornament, and it is the reward color. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-serif font-semibold leading-none ${className}`}>
      tauplo<span aria-hidden="true" className="text-reward">.</span>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Tauplo, pradžia" className={`shrink-0 text-ink ${className}`}>
      <Wordmark className="text-[26px]" />
    </Link>
  );
}
