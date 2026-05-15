import clsx from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-sage/60 bg-white/95 p-5 shadow-elevated backdrop-blur-[2px]",
        className,
      )}
    >
      {children}
    </section>
  );
}
