import clsx from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("rounded-2xl border border-white/70 bg-white/90 p-5 shadow-soft", className)}>{children}</section>;
}
